import logging

import time
from functools import wraps

#http (for urlfetch) and google api client imports
import httplib2
import sys
from oauth2client.client import SignedJwtAssertionCredentials
from google.appengine.api import memcache

# configuration settings
import properties

#from oauth2client.client import AccessTokenRefreshError

logging.getLogger().setLevel(logging.WARNING)


# Retry decorator with exponential backoff: http://www.saltycrane.com/blog/2009/11/trying-out-retry-decorator-python/
def retry(ExceptionToCheck, tries=3, delay=1, backoff=2, logger=None):
    """Retry calling the decorated function using an exponential backoff.

    http://www.saltycrane.com/blog/2009/11/trying-out-retry-decorator-python/
    original from: http://wiki.python.org/moin/PythonDecoratorLibrary#Retry

    :param ExceptionToCheck: the exception to check. may be a tuple of
        exceptions to check
    :type ExceptionToCheck: Exception or tuple
    :param tries: number of times to try (not retry) before giving up
    :type tries: int
    :param delay: initial delay between retries in seconds
    :type delay: int
    :param backoff: backoff multiplier e.g. value of 2 will double the delay
        each retry
    :type backoff: int
    :param logger: logger to use. If None, print
    :type logger: logging.Logger instance
    """
    def deco_retry(f):

        @wraps(f)
        def f_retry(*args, **kwargs):
            mtries, mdelay = tries, delay
            while mtries > 1:
                try:
                    return f(*args, **kwargs)
                except ExceptionToCheck, e:
                    msg = "*** %s, Retrying in %d seconds..." % (str(e), mdelay)
                    logging.info(msg)
                    time.sleep(mdelay)
                    mtries -= 1
                    mdelay *= backoff
            return f(*args, **kwargs)

        return f_retry  # true decorator

    return deco_retry
 
# define authorized http to apply to service calls
class AuthorizedHttp():

    @retry(Exception)
    # get an authorized HTTP object for a user
    def GetHttpObj(self, service_account_email, key, sub_email, scope):
            return SignedJwtAssertionCredentials(
                service_account_email,
                key,
                scope = scope, 
                sub = sub_email  # 'sub' supercedes the deprecated 'prn'
            ).authorize(httplib2.Http())

'''
# define credentials to apply to service calls
class ServiceAccount():

    @retry(Exception)
    def get_credentials(file, scopes):
        return service_account.Credentials.from_service_account_file(
            file, 
            scopes = scopes
            )                
'''            
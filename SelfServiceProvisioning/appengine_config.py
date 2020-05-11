# appengine_config.py

# https://github.com/GoogleCloudPlatform/google-auth-library-python/issues/169
# create a lib directory and install the following:
# - pip install -t lib/ google-auth
# - pip install -t lib/ google-api-python-client
# - pip install -t lib/ google-auth-httplib2
# - 

import os
import google
from google.appengine.ext import vendor

lib_directory = os.path.dirname(__file__) + '/lib'

# Change where to find the google package (point to the lib/ directory)
google.__path__ = [os.path.join(lib_directory, 'google')] + google.__path__

# Add any libraries install in the "lib" folder.
vendor.add(lib_directory)
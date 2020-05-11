import logging 
import string
import time

from apiclient import errors
from apiclient.discovery import build

from google.appengine.api import memcache

import properties
import service_utilities

logging.getLogger().setLevel(properties.log_level)
    
# retrieve this JSON: https://www.googleapis.com/discovery/v1/apis/drive/v2/rest (which requires no authentication)
# and create a helper class for constructing further requests 
#DRIVE_SERVICE = build("drive", "v2")

class DriveCrud():

    # get file
    def get_file(self, file_id, http_obj):
        #global DRIVE_SERVICE
        drive_service = build("drive", "v2", http=http_obj)

        content = memcache.get(file_id)
        if False: #content is not None:
            return content
        else:
            try:
                @service_utilities.retry(Exception)
                def file_retry():
                    return drive_service.files().get(
                         fileId=file_id).execute(http=http_obj)
                drive_file=file_retry()

                @service_utilities.retry(Exception)
                def export_links_retry(drive_file):
                    logging.info("return drive_file.get('exportLinks')")
                    return drive_file.get(
                      'exportLinks')
                #      'downloadUrl')
                export_links_obj = export_links_retry(drive_file)
                #download_url = export_links_retry(drive_file)

                #logging.warning('download_url: %s' % export_links_obj['text/plain'])

                if export_links_obj and export_links_obj['text/plain']:
                    logging.info("export_links_obj['text/plain'] %s" % export_links_obj['text/plain'])
                    @service_utilities.retry(Exception)
                    def export_links_retry(link):
                        logging.info('link %s' % link)
                        return drive_service._http.request(link)
                    resp, content = export_links_retry(export_links_obj['text/plain'])
                #if download_url:
                #    resp, content = drive_service._http.request(download_url)
                    if resp.status == 200:
                        # cleanup non-printable Docs characters: could also try this: http://stackoverflow.com/questions/6048085/python-write-unicode-text-to-a-text-file    
                        content = "".join(s for s in content if s in string.printable)            
                        memcache.add(file_id, content)
                        return content
                    else:
                        return None
                else:
                    # The file doesn't have any content stored on Drive.
                    return None
            except errors.HttpError, error:
                logging.warning('An error occurred: %s' % error)

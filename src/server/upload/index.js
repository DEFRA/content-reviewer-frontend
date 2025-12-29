import { uploadController } from './controller.js'

const upload = {
  plugin: {
    name: 'upload',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: '/upload',
          handler: uploadController.showUploadForm
        },
        {
          method: 'POST',
          path: '/upload/initiate',
          handler: uploadController.initiateUpload
        },
        {
          method: 'GET',
          path: '/upload/status-poller',
          handler: uploadController.statusPoller
        },
        {
          method: 'GET',
          path: '/upload/status/{uploadId}',
          handler: uploadController.getStatus
        },
        {
          method: 'GET',
          path: '/upload/complete',
          handler: uploadController.uploadComplete
        },
        {
          method: 'POST',
          path: '/upload/callback',
          handler: uploadController.handleCallback,
          options: {
            payload: {
              parse: true
            }
          }
        }
      ])
    }
  }
}

export { upload }

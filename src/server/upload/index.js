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
          path: '/upload/form',
          handler: (_request, h) => {
            return h.view('upload/upload-form', {
              pageTitle: 'Upload Document',
              heading: 'Upload Your Document'
            })
          }
        },
        {
          // CDP Uploader redirects here after scanning completes.
          // reviewId is available as a query param if needed in future.
          method: 'GET',
          path: '/upload/complete',
          handler: (_request, h) => h.redirect('/')
        }
      ])
    }
  }
}

export { upload }

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
        }
      ])
    }
  }
}

export { upload }

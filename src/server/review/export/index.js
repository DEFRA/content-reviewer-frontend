import { exportController } from './controller.js'

export default {
  plugin: {
    name: 'review-export',
    register: async (server) => {
      server.route([
        {
          method: 'GET',
          path: '/review/export/{id}/pdf',
          handler: exportController.exportPdf
        },
        {
          method: 'GET',
          path: '/review/export/{id}/word',
          handler: exportController.exportWord
        }
      ])
    }
  }
}

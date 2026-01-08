export default {
  plugin: {
    name: 'review',
    register: async (server) => {
      await server.register([
        {
          plugin: (await import('./results/index.js')).default
        },
        {
          plugin: (await import('./export/index.js')).default
        },
        {
          plugin: (await import('./debug/index.js')).default
        }
      ])
    }
  }
}

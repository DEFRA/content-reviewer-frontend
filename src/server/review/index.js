export default {
  plugin: {
    name: 'review',
    register: async (server) => {
      await server.register([
        {
          plugin: (await import('./status-poller/index.js')).default
        },
        {
          plugin: (await import('./results/index.js')).default
        },
        {
          plugin: (await import('./history/index.js')).default
        }
      ])
    }
  }
}

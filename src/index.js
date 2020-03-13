import { getContext, setPluginContext, getPluginContext } from 'kea'

/* usage:
kea({
  listeners: ({ actions, values, store, sharedListeners }) => ({
    [actions.openUrl]: ({ url }, breakpoint, action) => { actions.urlOpened(url) },
    [LOCATION_CHANGE]: [
      (payload, breakpoint, action) => { store.dispatch(...) },
      sharedListeners.otherListeForTheSameAction
    ]
  })
})
*/

export default {
  name: 'listeners',

  defaults: () => ({
    listeners: undefined,
    sharedListeners: undefined
  }),

  buildOrder: {
    listeners: { before: 'events' },
    sharedListeners: { before: 'listeners' }
  },

  buildSteps: {
    listeners (logic, input) {
      if (!input.listeners) {
        return
      }

      logic.cache.listenerBreakpointCounter = {}

      const fakeLogic = {
        ...logic
      }

      Object.defineProperty(fakeLogic, 'store', {
        get () {
          return getContext().store
        }
      })

      const newListeners = input.listeners(fakeLogic)

      logic.listeners = {
        ...(logic.listeners || {})
      }

      for (const key of Object.keys(newListeners)) {
        let newArray = Array.isArray(newListeners[key]) ? newListeners[key] : [newListeners[key]]
        newArray = newArray.map(l => {
          return async function (action) {
            const breakCounter = (fakeLogic.cache.listenerBreakpointCounter[key] || 0) + 1
            fakeLogic.cache.listenerBreakpointCounter[key] = breakCounter

            const throwIfCalled = () => {
              if (fakeLogic.cache.listenerBreakpointCounter[key] !== breakCounter) {
                throw new Error('kea-listeners breakpoint broke')
              }
            }
            const breakpoint = (ms) => {
              if (typeof ms !== 'undefined') {
                return new Promise(resolve => setTimeout(resolve, ms)).then(() => {
                  throwIfCalled()
                })
              } else {
                throwIfCalled()
              }
            }

            let response
            try {
              response = await l(action.payload, breakpoint, action)
            } catch (e) {
              if (e.message !== 'kea-listeners breakpoint broke') {
                throw e
              }
            }
            return response
          }
        })
        if (logic.listeners[key]) {
          logic.listeners[key] = [
            ...logic.listeners[key],
            ...newArray
          ]
        } else {
          logic.listeners[key] = newArray
        }
      }
    },

    sharedListeners (logic, input) {
      if (!input.sharedListeners) {
        return
      }

      const fakeLogic = {
        ...logic
      }

      Object.defineProperty(fakeLogic, 'store', {
        get () {
          return getContext().store
        }
      })

      const newSharedListeners = typeof input.sharedListeners === 'function' ? input.sharedListeners(fakeLogic) : input.sharedListeners

      logic.sharedListeners = {
        ...(logic.sharedListeners || {}),
        ...newSharedListeners
      }
    }
  },

  events: {
    afterPlugin () {
      setPluginContext('listeners', { byAction: {}, byPath: {} })
    },

    beforeReduxStore (options) {
      options.middleware.push(store => next => action => {
        const response = next(action)
        const { byAction } = getPluginContext('listeners')
        const listeners = byAction[action.type]
        if (listeners) {
          for (const listenerArray of Object.values(listeners)) {
            for (const innerListener of listenerArray) {
              innerListener(action)
            }
          }
        }
        return response
      })
    },

    afterMount (logic) {
      if (!logic.listeners) {
        return
      }
      addListenersByPathString(logic.pathString, logic.listeners)
    },

    beforeUnmount (logic) {
      if (!logic.listeners) {
        return
      }
      removeListenersByPathString(logic.pathString, logic.listeners)
    },

    beforeCloseContext () {
      setPluginContext('listeners', { byAction: {}, byPath: {} })
    }
  }
}

function addListenersByPathString (pathString, listeners) {
  const { byPath, byAction } = getPluginContext('listeners')

  byPath[pathString] = listeners

  Object.entries(listeners).forEach(([action, listener]) => {
    if (!byAction[action]) {
      byAction[action] = {}
    }
    byAction[action][pathString] = listener
  })
}

function removeListenersByPathString (pathString, listeners) {
  const { byPath, byAction } = getPluginContext('listeners')

  Object.entries(listeners).forEach(([action, listener]) => {
    delete byAction[action][pathString]
    if (Object.keys(byAction[action]).length === 0) {
      delete byAction[action]
    }
  })

  delete byPath[pathString]
}

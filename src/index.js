import { getContext } from 'kea'

/* usage:
kea({
  listeners: ({ actions, values, store, sharedListeners }) => ({
    [actions.openUrl]: ({ url }, breakpoint, action) => { actions.urlOpened(url) },
    [LOCATION_CHANGE]: [
      (payload, breakpoint, action) => { store.dispatch(...) },
      sharedListenres.otherListeForTheSameAction
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

  buildSteps: {
    sharedListeners (logic, input) {
      if (!input.sharedListeners) {
        return
      }

      const newWorkers = typeof input.sharedListeners === 'function' ? input.sharedListeners(logic) : input.sharedListeners
      logic.sharedListeners = {
        ...(logic.sharedListeners || {}),
        ...newWorkers
      }
    },

    listeners (logic, input) {
      if (!input.listeners) {
        return
      }

      const fakeLogic = {
        ...logic,
        _listenerBreakpointCounter: {}
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
            const breakCounter = (fakeLogic._listenerBreakpointCounter[key] || 0) + 1
            fakeLogic._listenerBreakpointCounter[key] = breakCounter
            const breakpoint = async (ms) => {
              if (typeof ms !== 'undefined') {
                await new Promise(resolve => setTimeout(resolve, ms))
              }
              if (fakeLogic._listenerBreakpointCounter[key] !== breakCounter) {
                throw new Error('breakpoint broke')
              }
            }
            let response
            try {
              response = await l(action.payload, breakpoint, action)
            } catch (e) {
              if (e.message !== 'breakpoint broke') {
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
    }
  },

  events: {
    afterOpenContext (context) {
      resetListenersOnContext(context)
    },

    beforeReduxStore (options) {
      options.middleware.push(store => next => action => {
        const response = next(action)
        const { listeners: { byAction } } = getContext()
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

    afterMount (pathString, logic) {
      if (!logic.listeners) {
        return
      }
      addListenersByPathString(pathString, logic.listeners)
    },

    afterUnmount (pathString, logic) {
      if (!logic.listeners) {
        return
      }
      removeListenersByPathString(pathString, logic.listeners)
    },

    beforeCloseContext (context) {
      resetListenersOnContext(context)
    }
  }
}

function resetListenersOnContext (context) {
  context.listeners = { byAction: {}, byPath: {} }
}

function addListenersByPathString (pathString, listeners) {
  const { listeners: { byPath, byAction } } = getContext()

  byPath[pathString] = listeners

  Object.entries(listeners).forEach(([action, listener]) => {
    if (!byAction[action]) {
      byAction[action] = {}
    }
    byAction[action][pathString] = listener
  })
}

function removeListenersByPathString (pathString, listeners) {
  const { listeners: { byPath, byAction } } = getContext()

  Object.entries(listeners).forEach(([action, listener]) => {
    delete byAction[action][pathString]
    if (Object.keys(byAction[action]).length === 0) {
      delete byAction[action]
    }
  })

  delete byPath[pathString]
}

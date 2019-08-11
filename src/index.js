import { getContext } from 'kea'

/* usage:
kea({ 
  listeners: ({ actions }) => ({ 
    [actions.openUrl]: (action, {}) => { do whatever }, 
    [LOCATION_CHANGE]: (action, { store }) => { store.dispatch(next) } 
  }) 
})
*/

// TODO: support multiple listeners for the same action on the same logic (e.g. with logic.extend())
// TODO: autobind actions
export default { 
  name: 'listeners',
  
  defaults: () => ({ 
    listeners: undefined,
    workers: undefined
  }),
  
  buildSteps: { 
    workers (logic, input) { 
      if (!input.workers) {
        return
      }

      const newWorkers = typeof input.workers === 'function' ? input.workers(logic) : input.workers
      logic.workers = { 
        ...(logic.workers || {}), 
        ...newWorkers 
      }
    },

    listeners (logic, input) { 
      if (!input.listeners) { 
        return
      }

      const fakeLogic = {
        ...logic,
        actions: {}
      }

      Object.keys(logic.actions).forEach(key => {
        fakeLogic.actions[key] = (...inp) => {
          return getContext().store.dispatch(logic.actions[key](...inp))
        }
        fakeLogic.actions[key].toString = () => logic.actions[key].toString()
      })

      const newListeners = input.listeners(fakeLogic)
      
      logic.listeners = { 
        ...(logic.listeners || {}), 
      }

      for (const key of Object.keys(newListeners)) {
        const newArray = Array.isArray(newListeners[key]) ? newListeners[key] : [newListeners[key]]
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
      const { listeners: { byAction } } = getContext()
      
      options.middleware.push(store => next => action => { 
        const response = next(action) 
        const listeners = byAction[action.type]
        if (listeners) { 
          for (const listenerArray of Object.values(listeners)) { 
            for (const innerListener of listenerArray) { 
              innerListener(action, store) 
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

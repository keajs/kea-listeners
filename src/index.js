import { getContext } from 'kea'

/* usage:
kea({ 
  listeners: ({ actions }) => ({ 
    [actions.openUrl]: (action, {}) => { do whatever }, 
    [LOCATION_CHANGE]: (action, { store }) => { store.dispatch(next) } 
  }) 
})
*/

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
        actionCreators: logic.actions,
        actions: {}
      }

      Object.defineProperty(fakeLogic, 'store', {
        get () {
          return getContext().store
        }
      })

      Object.keys(logic.actions).forEach(key => {
        const action = logic.actions[key]
        fakeLogic.actions[key] = (...inp) => fakeLogic.store.dispatch(action(...inp))
        fakeLogic.actions[key].toString = () => logic.actions[key].toString()
      })

      fakeLogic._breakpointCounter = {}

      const newListeners = input.listeners(fakeLogic)
      
      logic.listeners = { 
        ...(logic.listeners || {}), 
      }

      for (const key of Object.keys(newListeners)) {
        let newArray = Array.isArray(newListeners[key]) ? newListeners[key] : [newListeners[key]]
        newArray = newArray.map(l => {
          return async function (action) {
            const breakCounter = (fakeLogic._breakpointCounter[key] || 0) + 1
            fakeLogic._breakpointCounter[key] = breakCounter
            const breakpoint = async (ms) => {
              if (typeof ms !== 'undefined') {
                await new Promise(r => setTimeout(r, ms))
              }
              if (fakeLogic._breakpointCounter[key] !== breakCounter) {
                throw new Error('breakpoint broke')
              }
            }
            let response
            try {
              response = await l(action, breakpoint)
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

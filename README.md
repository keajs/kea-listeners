[![NPM Version](https://img.shields.io/npm/v/kea-listeners.svg)](https://www.npmjs.com/package/kea-listeners)
[![minified](https://badgen.net/bundlephobia/min/kea-listeners)](https://bundlephobia.com/result?p=kea-listeners)
[![minified + gzipped](https://badgen.net/bundlephobia/minzip/kea-listeners)](https://bundlephobia.com/result?p=kea-listeners)
[![Backers on Open Collective](https://opencollective.com/kea/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/kea/sponsors/badge.svg)](#sponsors)

# kea-listeners

Listners plugin for kea. Works with kea `1.0.0-rc.4` and up.

## What and why?

Listeners are functions that run after an action is dispatched.

They have built in support for cancellation if needed.

## Getting started

Add the package:

```sh
yarn add kea-listeners
```

... then add it to kea's plugins list:

```js
import listeners from 'kea-listener'

resetContext({
  plugins: [listeners]
})
```

## Sample usage

```js
kea({
  // ... 

  listeners: ({ actions, values, store, sharedListeners }) => ({
    // action that conditionally calls another action
    [actions.openUrl]: ({ url }) => { 
      // get the value from the reducer 'url'
      const currentUrl = values.url

      if (url !== currentUrl) {
        actions.reallyOpenTheUrl(url)
      }
    },
    
    // listen to any redux action type, not just ones defined in this logic
    'LOCATION_CHANGE': (payload) => {
      // do something with the regular redux action
      console.log(payload)
      store.dispatch({ 
        type: 'REDUX_ACTION', 
        payload: { redux: 'cool' } 
      })
    },
    
    // two listeners with one shared action
    [actions.anotherAction]: sharedListeners.sharedActionListener,
    [actions.yetAnotherAction]: sharedListeners.sharedActionListener,
    
    // Debounce for 300ms before making an API call
    // Break if this action was called again while we were sleeping
    [actions.debouncedFetchResults]: async ({ username }, breapoint) => {
      // If the same action gets called again while this waits, we will throw an exception
      // and catch it immediately, effectively cancelling the operation. 
      await breakpoint(300) 

      // Make an API call
      const user = await API.fetchUser(username)

      // if during the previous fetch this action was called again, then break here
      breakpoint()

      // save the result
      actions.userReceived(user)
    },

    // you can also pass an array of functions
    [actions.oneActionMultipleListeners]: [
      (payload, breakpoint, action) => { /* ... */ },
      sharedListeners.doSomething,
      sharedListeners.logAction
    ]
  }),

  // if multiple actions must trigger similar code, use sharedListeners
  sharedListeners: ({ actions, values, store }) => ({
    // all listeners and sharedListeners also get a third parameter:
    // - action = the full dispatched action
    sharedActionListener: function (payload, breakpoint, action) {
      if (action.type === actions.anotherAction.toString()) {
        // handle this case separately
      }
      // do something common for both
      console.log(action)
    }
  })
})
```

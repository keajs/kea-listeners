![NPM Version](https://img.shields.io/npm/v/kea-listeners.svg)
[![minified](https://badgen.net/bundlephobia/min/kea-listeners)](https://bundlephobia.com/result?p=kea-listeners)
[![minified + gzipped](https://badgen.net/bundlephobia/minzip/kea-listeners)](https://bundlephobia.com/result?p=kea-listeners)
[![Backers on Open Collective](https://opencollective.com/kea/backers/badge.svg)](#backers)
[![Sponsors on Open Collective](https://opencollective.com/kea/sponsors/badge.svg)](#sponsors)

Listners plugin for kea. Works with kea 1.0-rc.4 and up.

Listeners are functions that run after an action is dispatched.

Getting started:

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

Sample usage:

```js
kea({
  listeners: ({ actions, values, store, sharedListeners }) => ({
    [actions.openUrl]: ({ url }) => { 
      actions.urlOpened(url)
    },
    [LOCATION_CHANGE]: (payload) => {
      // do something with the regular redux action
      console.log(payload)
    },
    [actions.oneActionMultipleListeners]: [
      (payload) => { /* ... */ },
      sharedListeners.doSomething
    ],
    [actions.anotherAction]: sharedListeners.resolveAction,
    [actions.yetAnotherAction]: sharedListeners.resolveAction,
    [actions.debouncedFetchResults]: async ({ username }, breapoint) => {
      // Debounce for 300ms
      // If the same action gets called again while this waits, we will throw an exception
      // and catch it immediately, effectively cancellying the operation. 
      await breakpoint(300) 

      // Make an API call
      const user = await API.fetchUser(username)

      // if during the previous fetch this action was called again, then cancel saving the result
      breakpoint()

      // save the result
      actions.userReceived(user)
    }
  }),

  sharedListeners: () => ({
    resolveAction: function (payload, breakpoint, action) {
      if (action.type === actions.anotherAction.toString()) {
        // handle first
      } 
      // do something common for both
      console.log(action)
    }
  })
})

```
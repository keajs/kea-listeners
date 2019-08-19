/* global test, expect, beforeEach */
import { kea, resetContext, getStore, getContext } from 'kea'

import PropTypes from 'prop-types'

import listenersPlugin from '../index'

beforeEach(() => {
  resetContext({
    plugins: [listenersPlugin],
    createStore: { middleware: [] }
  })
})

test('listeners work', () => {
  const { store } = getContext()

  let listenerRan = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'first'],
    actions: () => ({
      updateName: name => ({ name })
    }),
    reducers: ({ actions }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    }),
    listeners: ({ actions }) => ({
      [actions.updateName]: action => {
        listenerRan = true
      }
    })
  })

  firstLogic.mount()

  expect(getContext().plugins.activated.map(p => p.name)).toEqual(['core', 'listeners'])
  expect(firstLogic._isKea).toBe(true)
  expect(firstLogic._isKeaWithKey).toBe(false)
  expect(Object.keys(firstLogic.actions)).toEqual(['updateName'])
  expect(Object.keys(firstLogic.selectors).sort()).toEqual(['name'])

  store.dispatch(firstLogic.actions.updateName('derpy'))
  expect(firstLogic.selectors.name(store.getState())).toBe('derpy')

  expect(listenerRan).toBe(true)
})

test('workers work', () => {
  const { store } = getContext()

  let listenerRan = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'workers'],
    actions: () => ({
      updateName: name => ({ name })
    }),
    reducers: ({ actions }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    }),
    listeners: ({ actions, workers }) => ({
      [actions.updateName]: workers.doUpdateName
    }),
    workers: ({ actions }) => ({
      doUpdateName (action) {
        listenerRan = true
      }
    })    
  })

  firstLogic.mount()

  store.dispatch(firstLogic.actions.updateName('derpy'))
  expect(firstLogic.selectors.name(store.getState())).toBe('derpy')

  expect(listenerRan).toBe(true)
})

test('many listeners for one action', () => {
  const { store } = getContext()

  let listenerRan1 = false
  let listenerRan2 = false
  let listenerRan3 = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'workers'],
    actions: () => ({
      updateName: name => ({ name })
    }),
    reducers: ({ actions }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    }),
    listeners: ({ actions, workers }) => ({
      [actions.updateName]: [
        workers.doUpdateName,
        workers.otherWorker,
        function () {
          listenerRan3 = true
        }
      ]
    }),
    workers: ({ actions }) => ({
      doUpdateName (action) {
        listenerRan1 = true
      },
      otherWorker (action) {
        listenerRan2 = true
      }
    })    
  })

  firstLogic.mount()

  store.dispatch(firstLogic.actions.updateName('derpy'))
  expect(firstLogic.selectors.name(store.getState())).toBe('derpy')

  expect(listenerRan1).toBe(true)
  expect(listenerRan2).toBe(true)
  expect(listenerRan3).toBe(true)
})

test('extend works', () => {
  const { store } = getContext()

  let listenerRan1 = false
  let listenerRan2 = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'workers'],
    actions: () => ({
      updateName: name => ({ name })
    }),
    reducers: ({ actions }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    }),
    listeners: ({ actions, workers }) => ({
      [actions.updateName]: () => {
        listenerRan1 = true
      }
    })
  })

  firstLogic.extend({
    listeners: ({ actions, workers }) => ({
      [actions.updateName]: () => {
        listenerRan2 = true
      }
    })
  })
  firstLogic.mount()

  store.dispatch(firstLogic.actions.updateName('derpy'))
  expect(firstLogic.selectors.name(store.getState())).toBe('derpy')

  expect(listenerRan1).toBe(true)
  expect(listenerRan2).toBe(true)
})

test('actions are bound', () => {
  const { store } = getContext()

  let listenerRan1 = false
  let listenerRan2 = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'workers'],
    actions: () => ({
      updateName: name => ({ name }),
      updateOtherName: name => ({ name })
    }),
    listeners: ({ actions, workers }) => ({
      [actions.updateName]: () => {
        actions.updateOtherName()
        listenerRan1 = true
      },
      [actions.updateOtherName]: () => {
        listenerRan2 = true
      }
    })
  })

  firstLogic.mount()
  store.dispatch(firstLogic.actions.updateName('derpy'))

  expect(listenerRan1).toBe(true)
  expect(listenerRan2).toBe(true)
})

test('store exists', () => {
  const { store } = getContext()

  let listenerRan1 = false
  let listenerRan2 = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'workers2'],
    actions: () => ({
      updateName: name => ({ name }),
      updateOtherName: name => ({ name })
    }),
    reducers: ({ actions }) => ({
      name: ['john', {
        [actions.updateName]: (_, payload) => payload.name,
        [actions.updateOtherName]: (_, payload) => payload.name
      }]
    }),
    listeners: ({ actions, actionCreators, selectors, store }) => ({
      [actions.updateName]: () => {
        store.dispatch(actionCreators.updateOtherName('mike'))
        expect(selectors.name(store.getState())).toBe('mike')
        listenerRan1 = true
      },
      [actions.updateOtherName]: () => {
        listenerRan2 = true
      }
    })
  })

  firstLogic.mount()
  store.dispatch(firstLogic.actions.updateName('henry'))

  expect(firstLogic.selectors.name(store.getState())).toBe('mike')

  expect(listenerRan1).toBe(true)
  expect(listenerRan2).toBe(true)
})

test('actions and values', () => {
  const { store } = getContext()

  let listenerRan1 = false
  let listenerRan2 = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'workers2'],
    actions: () => ({
      updateName: name => ({ name }),
      updateOtherName: name => ({ name })
    }),
    reducers: ({ actions }) => ({
      name: ['john', {
        [actions.updateName]: (_, payload) => payload.name,
        [actions.updateOtherName]: (_, payload) => payload.name
      }]
    }),
    listeners: ({ actions, values }) => ({
      [actions.updateName]: action => {
        expect(action.payload.name).toBe('henry')
        expect(values.name).toBe('henry')
        actions.updateOtherName('mike')
        expect(values.name).toBe('mike')
        listenerRan1 = true
      },
      [actions.updateOtherName]: () => {
        listenerRan2 = true
      }
    })
  })

  firstLogic.mount()
  store.dispatch(firstLogic.actions.updateName('henry'))

  expect(firstLogic.values.name).toBe('mike')

  expect(listenerRan1).toBe(true)
  expect(listenerRan2).toBe(true)
})


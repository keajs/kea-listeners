/* global test, expect, beforeEach */
import { kea, resetContext, getStore, getContext } from 'kea'

import PropTypes from 'prop-types'

import listenersPlugin from '../index'

beforeEach(() => {
  resetContext({
    plugins: [listenersPlugin],
    createStore: {}
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
        console.log('ran listeners')
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
    workers: {
      doUpdateName ({ name }) {
        listenerRan = true
      }
    }
    
  })

  firstLogic.mount()

  store.dispatch(firstLogic.actions.updateName('derpy'))
  expect(firstLogic.selectors.name(store.getState())).toBe('derpy')

  expect(listenerRan).toBe(true)
})

test.skip('listeners can call listeners', () => {
  const store = getStore()

  let firstThunkRan = false
  let secondThunkRan = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'first'],
    actions: ({ constants }) => ({
      updateName: name => ({ name })
    }),
    listeners: ({ actions, dispatch, getState }) => ({
      updateNameAsync: name => {
        firstThunkRan = true
        actions.updateName(name)
      },
      updateNameReallyAsync: name => {
        secondThunkRan = true
        actions.updateNameAsync(name)
      }
    }),
    reducers: ({ actions, constants }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    })
  })

  expect(getContext().plugins.activated.map(p => p.name)).toEqual(['core', 'listener'])
  expect(Object.keys(firstLogic.actions)).toEqual(['updateName', 'updateNameAsync', 'updateNameReallyAsync'])
  expect(Object.keys(firstLogic.selectors).sort()).toEqual(['name'])

  store.dispatch(firstLogic.actions.updateNameReallyAsync('derpy'))
  expect(firstLogic.selectors.name(store.getState())).toBe('derpy')

  expect(firstThunkRan).toBe(true)
  expect(secondThunkRan).toBe(true)
})

test.skip('connected listeners work', () => {
  const store = getStore()

  let listenerRan = false

  const firstLogic = kea({
    path: () => ['scenes', 'listeners', 'first'],
    actions: ({ constants }) => ({
      updateName: name => ({ name })
    }),
    listeners: ({ actions, dispatch, getState }) => ({
      updateNameAsync: name => {
        listenerRan = true
        actions.updateName(name)
      }
    }),
    reducers: ({ actions, constants }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    })
  })

  const secondLogic = kea({
    connect: {
      actions: [
        firstLogic, [
          'updateNameAsync'
        ]
      ],
      props: [
        firstLogic, [
          'name'
        ]
      ]
    }
  })

  expect(getContext().plugins.activated.map(p => p.name)).toEqual(['core', 'listener'])
  expect(Object.keys(secondLogic.actions)).toEqual(['updateNameAsync'])
  expect(Object.keys(secondLogic.selectors).sort()).toEqual(['name'])

  store.dispatch(secondLogic.actions.updateNameAsync('derpy'))
  expect(secondLogic.selectors.name(store.getState())).toBe('derpy')

  expect(listenerRan).toBe(true)
})

test.skip('async works', () => {
  const store = getStore()

  let actionsRan = []

  const instantPromise = () => new Promise(resolve => {
    actionsRan.push('in promise')
    resolve()
  })

  const asyncLogic = kea({
    path: () => ['scenes', 'listeners', 'async'],
    actions: ({ constants }) => ({
      updateName: name => ({ name })
    }),
    listeners: ({ actions, selectors, get, fetch, dispatch, getState }) => ({
      updateNameAsync: async name => {
        actionsRan.push('before promise')
        await instantPromise()
        actionsRan.push('after promise')

        await actions.anotherThunk()
        actions.updateName(name)

        expect(selectors.name(getState())).toEqual('derpy')
        expect(get('name')).toEqual('derpy')
        expect(fetch('name')).toEqual({ name: 'derpy' })
      },
      anotherThunk: async () => {
        actionsRan.push('another listener ran')
      }
    }),
    reducers: ({ actions, constants }) => ({
      name: ['chirpy', PropTypes.string, {
        [actions.updateName]: (state, payload) => payload.name
      }]
    })
  })
  actionsRan.push('before action')

  return store.dispatch(asyncLogic.actions.updateNameAsync('derpy')).then(() => {
    actionsRan.push('after dispatch')
    expect(asyncLogic.selectors.name(store.getState())).toBe('derpy')
    actionsRan.push('after action')

    expect(actionsRan).toEqual([
      'before action',
      'before promise',
      'in promise',
      'after promise',
      'another listener ran',
      'after dispatch',
      'after action'
    ])
  })
})

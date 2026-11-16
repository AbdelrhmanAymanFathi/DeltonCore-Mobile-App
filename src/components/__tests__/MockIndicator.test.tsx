import { render } from '@testing-library/react-native'
import React from 'react'

jest.mock('../../api/mock', () => {
  let active = false
  return {
    installMockApi: jest.fn(() => {
      active = true
    }),
    isMockActive: jest.fn(() => active),
    __setActive: (v: boolean) => {
      active = v
    },
  }
})

import { isMockActive, installMockApi } from '../../api/mock'
import { MockIndicator } from '../MockIndicator'

describe('MOCK indicator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(isMockActive as jest.Mock).mockReturnValue(false)
    ;(installMockApi as jest.Mock).mockImplementation(() => {
      ;(isMockActive as jest.Mock).mockReturnValue(true)
    })
  })

  it('isMockActive returns false before installMockApi', () => {
    expect(isMockActive()).toBe(false)
  })

  it('isMockActive returns true after installMockApi with flag', () => {
    process.env.EXPO_PUBLIC_USE_MOCK = '1'
    installMockApi()
    expect(isMockActive()).toBe(true)
    delete process.env.EXPO_PUBLIC_USE_MOCK
  })

  it('renders null when mock is not active', async () => {
    delete process.env.EXPO_PUBLIC_USE_MOCK
    const result = await render(<MockIndicator />)
    expect(result.toJSON()).toBeNull()
  })

  it('renders a banner when mock is active', async () => {
    process.env.EXPO_PUBLIC_USE_MOCK = '1'
    const result = await render(<MockIndicator />)
    expect(result.toJSON()).not.toBeNull()
    delete process.env.EXPO_PUBLIC_USE_MOCK
  })
})

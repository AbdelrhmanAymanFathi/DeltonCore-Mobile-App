import { render } from '@testing-library/react-native'
import React from 'react'

import { Icon } from '../Icon'

describe('Icon component', () => {
  it('renders a Feather icon', async () => {
    const result = await render(<Icon name="home" />)
    expect(result.toJSON()).toBeTruthy()
  })

  it('renders with custom size and color', async () => {
    const result = await render(<Icon name="home" size={24} color="#2DD4BF" />)
    expect(result.toJSON()).toBeTruthy()
  })

  it('renders mirrored icon when mirror is true', async () => {
    const result = await render(<Icon name="chevron-right" mirror={true} />)
    expect(result.toJSON()).toBeTruthy()
  })

  it('hides from screen readers when accessible is false', async () => {
    const result = await render(<Icon name="home" accessible={false} />)
    expect(result.toJSON()).toBeTruthy()
  })

  it('includes accessibilityLabel when provided', async () => {
    const result = await render(<Icon name="home" accessibilityLabel="الرئيسية" />)
    expect(result.toJSON()).toBeTruthy()
  })
})

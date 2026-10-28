import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DroneFeed } from './DroneFeed'
import { createSim } from '../lib/simEngine'
import { SCENE } from '../lib/scene'

const HOME = { lat: -35.3633515, lng: 149.1652412 }

describe('DroneFeed', () => {
  it('C1 shows the aerial photo and boxes a found person under the drone', () => {
    const s = createSim({ home: HOME })
    const v = { ...s.survivors[0], status: 'pending' }
    const { container } = render(<DroneFeed name="Drone 01" drone={{ ...s.drones.d1, pos: { ...v.pos } }} home={HOME} survivors={[v]} />)
    expect(container.querySelector(`img[src="${SCENE.src}"]`)).not.toBeNull()
    expect(screen.getByText(`Human ${v.conf.toFixed(2)}`)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /1 person detected/ })).toBeInTheDocument()
  })
})

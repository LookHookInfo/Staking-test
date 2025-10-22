'use client'

import dynamic from 'next/dynamic'

const Staking = dynamic(() => import('./Staking'), { ssr: false })

export default function Home() {
  return (
    <main>
      <Staking />
    </main>
  )
}

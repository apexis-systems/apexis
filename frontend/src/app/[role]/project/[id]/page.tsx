import Project from '@/pages/Role/Project/Project'
import { use } from 'react'

export default function page({ params }: { params: Promise<{ role: string; id: string }> }) {
    const { id } = use(params)
    return <Project id={id} />
}

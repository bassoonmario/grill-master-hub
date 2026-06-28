import { StatusTag } from 'bbq-factory-os'

export const New = () => <div style={{ padding: 16, background: 'var(--bg)' }}><StatusTag type="new" /></div>
export const Active = () => <div style={{ padding: 16, background: 'var(--bg)' }}><StatusTag type="active" /></div>
export const Progress = () => <div style={{ padding: 16, background: 'var(--bg)' }}><StatusTag type="progress" /></div>
export const Done = () => <div style={{ padding: 16, background: 'var(--bg)' }}><StatusTag type="done" /></div>
export const Pending = () => <div style={{ padding: 16, background: 'var(--bg)' }}><StatusTag type="pending" /></div>

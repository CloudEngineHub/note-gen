import { NoteSidebar } from "./mark"
import Chat from './chat'

export default function Page() {
  return (
    <div className="flex h-screen">
      <NoteSidebar />
      <Chat />
    </div>
  )
}

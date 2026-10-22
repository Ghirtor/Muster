import { WebSocketGateway } from '@nestjs/websockets'
import type { OnGatewayConnection } from '@nestjs/websockets'
import type { WebSocket } from 'ws'

import { Hub } from './hub'

/**
 * The WebSocket at `/api/ws`. Its messages are `{type, topics}` rather than Nest's `{event, data}`,
 * so it binds no message handlers: every client goes to the hub, which reads them itself.
 */
@WebSocketGateway({ path: '/api/ws' })
export class HubGateway implements OnGatewayConnection {
  constructor(private readonly hub: Hub) {}

  /** Hands a new client to the hub. */
  handleConnection(client: WebSocket): void {
    this.hub.add(client)
  }
}

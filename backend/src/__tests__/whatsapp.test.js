import { vi, describe, it, expect, beforeEach } from 'vitest'

process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.WHATSAPP_PHONE_ID = 'test-phone-id'

vi.mock('../db/client.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ whatsapp_token: 'test-wa-token' }] }),
}))

const mockCreate = vi.fn()
vi.mock('openai', () => ({
  default: class OpenAI {
    constructor() {
      this.chat = { completions: { create: mockCreate } }
    }
  },
}))

const { manejarMensajeEntrante, MENSAJE_FALLBACK_ERROR } = await import('../routes/whatsapp.js')

describe('manejarMensajeEntrante — fallback cuando OpenAI falla', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.test' }] }),
    })
  })

  it('envia el mensaje de fallback al cliente cuando OpenAI lanza un error de red (Premature close)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Premature close'))

    await manejarMensajeEntrante('50588888888', 'hola')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [, options] = global.fetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.to).toBe('50588888888')
    expect(body.text.body).toBe(MENSAJE_FALLBACK_ERROR)
  })

  it('envia la respuesta real de la IA cuando OpenAI responde correctamente', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Hola! Bienvenido a Marquez.' } }],
    })

    await manejarMensajeEntrante('50588888888', 'hola')

    const [, options] = global.fetch.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.text.body).toBe('Hola! Bienvenido a Marquez.')
  })

  it('no lanza excepcion aunque tambien falle el envio del fallback (no debe tumbar el proceso)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Premature close'))
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: 'Meta API caida' } }),
    })

    await expect(manejarMensajeEntrante('50588888888', 'hola')).resolves.toBeUndefined()
  })
})

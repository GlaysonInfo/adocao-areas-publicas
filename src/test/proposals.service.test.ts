// src/test/proposals.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { proposalsService } from '../services/proposals.service'
import type { PropostaAdocao, KanbanColuna } from '../domain/proposal'
import { useHttpApiEnabled } from '../lib/feature-flags'
import { proposalsHttpService } from '../services/http/proposals-http.service'
import { listProposals, listMyProposals, getProposalById, createProposal, moveProposal } from '../storage/proposals'

// Mock the dependencies
vi.mock('../lib/feature-flags', () => ({
  useHttpApiEnabled: vi.fn(),
}))

vi.mock('../services/http/proposals-http.service', () => ({
  proposalsHttpService: {
    listAll: vi.fn(),
    listMine: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    move: vi.fn(),
  },
}))

vi.mock('../storage/proposals', () => ({
  listProposals: vi.fn(),
  listMyProposals: vi.fn(),
  getProposalById: vi.fn(),
  createProposal: vi.fn(),
  moveProposal: vi.fn(),
  subscribeProposals: vi.fn(),
  adopterUpdateAndResubmitFromAdjustments: vi.fn(),
  resubmitAfterAdjustments: vi.fn(),
  listProposalEvents: vi.fn(),
  listProposalEventsBetween: vi.fn(),
  computeConsolidatedByPeriod: vi.fn(),
  computeSemadProductivity: vi.fn(),
  computeSlaByColumn: vi.fn(),
}))

// Helper to create mock proposal
const createMockProposal = (overrides?: Partial<PropostaAdocao>): PropostaAdocao => ({
  id: '1',
  codigo_protocolo: 'PROTO-001',
  area_id: 'area1',
  area_nome: 'Area 1',
  descricao_plano: 'Plan description',
  kanban_coluna: 'protocolo',
  documentos: [],
  owner_role: 'user1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  history: [],
  ...overrides,
})

describe('proposalsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listAllAsync', () => {
    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockProposals = [createMockProposal()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(listProposals).mockReturnValue(mockProposals)

      // Act
      const result = await proposalsService.listAllAsync()

      // Assert
      expect(result).toEqual(mockProposals)
      expect(listProposals).toHaveBeenCalled()
      expect(proposalsHttpService.listAll).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockProposals = [createMockProposal()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(proposalsHttpService.listAll).mockResolvedValue(mockProposals)

      // Act
      const result = await proposalsService.listAllAsync()

      // Assert
      expect(result).toEqual(mockProposals)
      expect(proposalsHttpService.listAll).toHaveBeenCalled()
      expect(listProposals).not.toHaveBeenCalled()
    })
  })

  describe('listMineAsync', () => {
    it('should return empty array for empty ownerRole', async () => {
      // Act
      const result = await proposalsService.listMineAsync(null)

      // Assert
      expect(result).toEqual([])
      expect(listMyProposals).not.toHaveBeenCalled()
      expect(proposalsHttpService.listMine).not.toHaveBeenCalled()
    })

    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockProposals = [createMockProposal({ owner_role: 'user1' })]
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(listMyProposals).mockReturnValue(mockProposals)

      // Act
      const result = await proposalsService.listMineAsync('user1')

      // Assert
      expect(result).toEqual(mockProposals)
      expect(listMyProposals).toHaveBeenCalledWith('user1')
      expect(proposalsHttpService.listMine).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockProposals = [createMockProposal({ owner_role: 'user1' })]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(proposalsHttpService.listMine).mockResolvedValue(mockProposals)

      // Act
      const result = await proposalsService.listMineAsync('user1')

      // Assert
      expect(result).toEqual(mockProposals)
      expect(proposalsHttpService.listMine).toHaveBeenCalledWith('user1')
      expect(listMyProposals).not.toHaveBeenCalled()
    })
  })

  describe('getByIdAsync', () => {
    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockProposal = createMockProposal()
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(getProposalById).mockReturnValue(mockProposal)

      // Act
      const result = await proposalsService.getByIdAsync('1')

      // Assert
      expect(result).toEqual(mockProposal)
      expect(getProposalById).toHaveBeenCalledWith('1')
      expect(proposalsHttpService.getById).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockProposal = createMockProposal()
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(proposalsHttpService.getById).mockResolvedValue(mockProposal)

      // Act
      const result = await proposalsService.getByIdAsync('1')

      // Assert
      expect(result).toEqual(mockProposal)
      expect(proposalsHttpService.getById).toHaveBeenCalledWith('1')
      expect(getProposalById).not.toHaveBeenCalled()
    })
  })

  describe('createAsync', () => {
    const input = {
      area_id: 'area1',
      area_nome: 'Area 1',
      descricao_plano: 'Plan description',
      owner_role: 'user1'
    }

    it('should create locally when HTTP API is disabled', async () => {
      // Arrange
      const mockProposal = createMockProposal({ ...input, id: 'local_123' })
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(createProposal).mockReturnValue(mockProposal)

      // Act
      const result = await proposalsService.createAsync(input)

      // Assert
      expect(result).toEqual(mockProposal)
      expect(createProposal).toHaveBeenCalled()
      expect(proposalsHttpService.create).not.toHaveBeenCalled()
    })

    it('should create via HTTP API and cache when enabled', async () => {
      // Arrange
      const mockCreated = createMockProposal({ ...input, id: 'api_123' })
      const mockAll = [mockCreated]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(proposalsHttpService.create).mockResolvedValue(mockCreated)
      vi.mocked(proposalsHttpService.listAll).mockResolvedValue(mockAll)

      // Mock localStorage
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      // Act
      const result = await proposalsService.createAsync(input)

      // Assert
      expect(result).toEqual(mockCreated)
      expect(proposalsHttpService.create).toHaveBeenCalledWith(input)
      expect(proposalsHttpService.listAll).toHaveBeenCalled()
      expect(setItemSpy).toHaveBeenCalledWith('mvp_proposals_v1', JSON.stringify(mockAll))
      expect(createProposal).not.toHaveBeenCalled()

      setItemSpy.mockRestore()
    })
  })

  describe('moveAsync', () => {
    const input = { id: '1', to: 'analise' as KanbanColuna, actor_role: 'user1', note: 'Moving' }

    it('should move locally when HTTP API is disabled', async () => {
      // Arrange
      const mockProposal = createMockProposal({ kanban_coluna: 'analise_semad' })
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(moveProposal).mockReturnValue(mockProposal)

      // Act
      const result = await proposalsService.moveAsync(input)

      // Assert
      expect(result).toEqual(mockProposal)
      expect(moveProposal).toHaveBeenCalledWith('1', 'analise', 'user1', 'Moving')
      expect(proposalsHttpService.move).not.toHaveBeenCalled()
    })

    it('should move via HTTP API and cache when enabled', async () => {
      // Arrange
      const mockMoved = createMockProposal({ kanban_coluna: 'analise_semad' })
      const mockAll = [mockMoved]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(proposalsHttpService.move).mockResolvedValue(mockMoved)
      vi.mocked(proposalsHttpService.listAll).mockResolvedValue(mockAll)

      // Mock localStorage
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      // Act
      const result = await proposalsService.moveAsync(input)

      // Assert
      expect(result).toEqual(mockMoved)
      expect(proposalsHttpService.move).toHaveBeenCalledWith(input)
      expect(proposalsHttpService.listAll).toHaveBeenCalled()
      expect(setItemSpy).toHaveBeenCalledWith('mvp_proposals_v1', JSON.stringify(mockAll))
      expect(moveProposal).not.toHaveBeenCalled()

      setItemSpy.mockRestore()
    })
  })

  describe('syncFromApi', () => {
    it('should return local proposals when HTTP API is disabled', async () => {
      // Arrange
      const mockProposals = [createMockProposal()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(listProposals).mockReturnValue(mockProposals)

      // Act
      const result = await proposalsService.syncFromApi()

      // Assert
      expect(result).toEqual(mockProposals)
      expect(listProposals).toHaveBeenCalled()
      expect(proposalsHttpService.listAll).not.toHaveBeenCalled()
    })

    it('should fetch from API and cache when HTTP API is enabled', async () => {
      // Arrange
      const mockProposals = [createMockProposal()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(proposalsHttpService.listAll).mockResolvedValue(mockProposals)

      // Mock localStorage
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      // Act
      const result = await proposalsService.syncFromApi()

      // Assert
      expect(result).toEqual(mockProposals)
      expect(proposalsHttpService.listAll).toHaveBeenCalled()
      expect(setItemSpy).toHaveBeenCalledWith('mvp_proposals_v1', JSON.stringify(mockProposals))
      expect(listProposals).not.toHaveBeenCalled()

      setItemSpy.mockRestore()
    })
  })
})

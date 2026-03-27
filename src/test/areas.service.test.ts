// src/test/areas.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { areasService } from '../services/areas.service'
import type { AreaPublica } from '../domain/area'
import { useHttpApiEnabled } from '../lib/feature-flags'
import { areasHttpService } from '../services/http/areas-http.service'
import { listAreas, listAreasPublic, getAreaById, getAreaByCodigo } from '../storage/areas'

// Mock the dependencies
vi.mock('../lib/feature-flags', () => ({
  useHttpApiEnabled: vi.fn(),
}))

vi.mock('../services/http/areas-http.service', () => ({
  areasHttpService: {
    listAll: vi.fn(),
    listPublic: vi.fn(),
    getById: vi.fn(),
    getByCodigo: vi.fn(),
  },
}))

vi.mock('../storage/areas', () => ({
  listAreas: vi.fn(),
  listAreasPublic: vi.fn(),
  getAreaById: vi.fn(),
  getAreaByCodigo: vi.fn(),
  subscribeAreas: vi.fn(),
  createArea: vi.fn(),
  upsertArea: vi.fn(),
  setAreaActive: vi.fn(),
  setAreaStatus: vi.fn(),
  setAreaGeoFile: vi.fn(),
  importAreasFromCSV: vi.fn(),
  clearAreasForImportTesting: vi.fn(),
}))

// Helper to create mock area
const createMockArea = (overrides?: Partial<AreaPublica>): AreaPublica => ({
  id: '1',
  codigo: 'A001',
  nome: 'Area 1',
  tipo: 'Praça',
  bairro: 'Centro',
  logradouro: 'Rua Principal',
  metragem_m2: 1000,
  status: 'disponivel',
  ativo: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

describe('areasService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('listAllAsync', () => {
    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockAreas = [createMockArea()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(listAreas).mockReturnValue(mockAreas)

      // Act
      const result = await areasService.listAllAsync()

      // Assert
      expect(result).toEqual(mockAreas)
      expect(listAreas).toHaveBeenCalled()
      expect(areasHttpService.listAll).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockAreas = [createMockArea()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(areasHttpService.listAll).mockResolvedValue(mockAreas)

      // Act
      const result = await areasService.listAllAsync()

      // Assert
      expect(result).toEqual(mockAreas)
      expect(areasHttpService.listAll).toHaveBeenCalled()
      expect(listAreas).not.toHaveBeenCalled()
    })
  })

  describe('listPublicAsync', () => {
    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockAreas = [createMockArea({ ativo: true })]
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(listAreasPublic).mockReturnValue(mockAreas)

      // Act
      const result = await areasService.listPublicAsync()

      // Assert
      expect(result).toEqual(mockAreas)
      expect(listAreasPublic).toHaveBeenCalled()
      expect(areasHttpService.listPublic).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockAreas = [createMockArea({ ativo: true })]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(areasHttpService.listPublic).mockResolvedValue(mockAreas)

      // Act
      const result = await areasService.listPublicAsync()

      // Assert
      expect(result).toEqual(mockAreas)
      expect(areasHttpService.listPublic).toHaveBeenCalled()
      expect(listAreasPublic).not.toHaveBeenCalled()
    })
  })

  describe('getByIdAsync', () => {
    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockArea = createMockArea()
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(getAreaById).mockReturnValue(mockArea)

      // Act
      const result = await areasService.getByIdAsync('1')

      // Assert
      expect(result).toEqual(mockArea)
      expect(getAreaById).toHaveBeenCalledWith('1')
      expect(areasHttpService.getById).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockArea = createMockArea()
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(areasHttpService.getById).mockResolvedValue(mockArea)

      // Act
      const result = await areasService.getByIdAsync('1')

      // Assert
      expect(result).toEqual(mockArea)
      expect(areasHttpService.getById).toHaveBeenCalledWith('1')
      expect(getAreaById).not.toHaveBeenCalled()
    })
  })

  describe('getByCodigoAsync', () => {
    it('should use local storage when HTTP API is disabled', async () => {
      // Arrange
      const mockArea = createMockArea({ codigo: 'A001' })
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(getAreaByCodigo).mockReturnValue(mockArea)

      // Act
      const result = await areasService.getByCodigoAsync('A001')

      // Assert
      expect(result).toEqual(mockArea)
      expect(getAreaByCodigo).toHaveBeenCalledWith('A001')
      expect(areasHttpService.getByCodigo).not.toHaveBeenCalled()
    })

    it('should use HTTP API when enabled', async () => {
      // Arrange
      const mockArea = createMockArea({ codigo: 'A001' })
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(areasHttpService.getByCodigo).mockResolvedValue(mockArea)

      // Act
      const result = await areasService.getByCodigoAsync('A001')

      // Assert
      expect(result).toEqual(mockArea)
      expect(areasHttpService.getByCodigo).toHaveBeenCalledWith('A001')
      expect(getAreaByCodigo).not.toHaveBeenCalled()
    })
  })

  describe('syncFromApi', () => {
    it('should return local areas when HTTP API is disabled', async () => {
      // Arrange
      const mockAreas = [createMockArea()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(false)
      vi.mocked(listAreas).mockReturnValue(mockAreas)

      // Act
      const result = await areasService.syncFromApi()

      // Assert
      expect(result).toEqual(mockAreas)
      expect(listAreas).toHaveBeenCalled()
      expect(areasHttpService.listAll).not.toHaveBeenCalled()
    })

    it('should fetch from API and cache when HTTP API is enabled', async () => {
      // Arrange
      const mockAreas = [createMockArea()]
      vi.mocked(useHttpApiEnabled).mockReturnValue(true)
      vi.mocked(areasHttpService.listAll).mockResolvedValue(mockAreas)

      // Mock localStorage
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')

      // Act
      const result = await areasService.syncFromApi()

      // Assert
      expect(result).toEqual(mockAreas)
      expect(areasHttpService.listAll).toHaveBeenCalled()
      expect(setItemSpy).toHaveBeenCalledWith('mvp_areas_v1', JSON.stringify(mockAreas))
      expect(listAreas).not.toHaveBeenCalled()

      setItemSpy.mockRestore()
    })
  })
})
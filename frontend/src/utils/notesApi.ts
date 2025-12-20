import { getAuthToken } from './auth'

export interface Note {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

export interface CreateNoteRequest {
  title: string
  content: string
}

export interface UpdateNoteRequest {
  title?: string
  content?: string
}

export interface NotesSearchResult {
  notes: Note[]
  totalCount: number
}

export interface NotesStats {
  totalNotes: number
  totalCharacters: number
  averageNoteLength: number
  lastUpdated: string | null
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Helper function to make authenticated requests
async function makeRequest(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken()
  if (!token) {
    throw new Error('No authentication token found')
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// Get all notes
export async function getNotes(): Promise<Note[]> {
  const response = await makeRequest('/api/notes')
  return response.data
}

// Get specific note by ID
export async function getNoteById(noteId: string): Promise<Note> {
  const response = await makeRequest(`/api/notes/${noteId}`)
  return response.data
}

// Create new note
export async function createNote(data: CreateNoteRequest): Promise<Note> {
  const response = await makeRequest('/api/notes', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.data
}

// Update existing note
export async function updateNote(noteId: string, data: UpdateNoteRequest): Promise<Note> {
  const response = await makeRequest(`/api/notes/${noteId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return response.data
}

// Delete note
export async function deleteNote(noteId: string): Promise<void> {
  await makeRequest(`/api/notes/${noteId}`, {
    method: 'DELETE',
  })
}

// Search notes
export async function searchNotes(query: string, limit?: number): Promise<NotesSearchResult> {
  const url = `/api/notes/search/${encodeURIComponent(query)}${limit ? `?limit=${limit}` : ''}`
  const response = await makeRequest(url)
  return response.data
}

// Get notes statistics
export async function getNotesStats(): Promise<NotesStats> {
  const response = await makeRequest('/api/notes/stats')
  return response.data
}

// Get recent notes
export async function getRecentNotes(limit: number = 10): Promise<Note[]> {
  const response = await makeRequest(`/api/notes/recent?limit=${limit}`)
  return response.data
}
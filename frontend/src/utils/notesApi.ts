import api from './api'

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

// Get all notes
export async function getNotes(): Promise<Note[]> {
  const response = await api.get('/api/notes')
  return response.data?.data || []
}

// Get specific note by ID
export async function getNoteById(noteId: string): Promise<Note> {
  const response = await api.get(`/api/notes/${noteId}`)
  return response.data?.data
}

// Create new note
export async function createNote(data: CreateNoteRequest): Promise<Note> {
  const response = await api.post('/api/notes', data)
  return response.data?.data
}

// Update existing note
export async function updateNote(noteId: string, data: UpdateNoteRequest): Promise<Note> {
  const response = await api.put(`/api/notes/${noteId}`, data)
  return response.data?.data
}

// Delete note
export async function deleteNote(noteId: string): Promise<void> {
  await api.delete(`/api/notes/${noteId}`)
}

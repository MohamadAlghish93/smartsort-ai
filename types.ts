// Native File System Access API Types (partial polyfill for TS)
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>;
  move?(destination: FileSystemDirectoryHandle, newName?: string): Promise<void>; // Experimental
  move?(newName: string): Promise<void>; // Experimental
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  values(): AsyncIterableIterator<FileSystemHandle>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

// App Specific Types
export interface FileRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  handle: FileSystemFileHandle;
  path: string; // Relative path from root
  lastModified: number;
}

export interface AIAnalysisResult {
  originalName: string;
  suggestedCategory: string; // e.g., "Documents", "Images"
  suggestedPath: string; // e.g., "Documents/Invoices"
  isSensitive: boolean;
  tags: string[];
  reasoning: string;
}

export interface OrganizedFile extends FileRecord {
  analysis?: AIAnalysisResult;
  status: 'pending' | 'analyzing' | 'ready' | 'moving' | 'done' | 'error';
}

export type SortMethod = 'name' | 'size' | 'date' | 'type';
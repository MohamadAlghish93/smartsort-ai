import { FileRecord, FileSystemDirectoryHandle, FileSystemFileHandle } from '../types';

export const verifyPermission = async (fileHandle: FileSystemDirectoryHandle, readWrite: boolean = false) => {
  const options: { mode: 'read' | 'readwrite' } = { mode: readWrite ? 'readwrite' : 'read' };
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
};

export const scanDirectory = async (
  dirHandle: FileSystemDirectoryHandle, 
  path: string = ''
): Promise<FileRecord[]> => {
  let files: FileRecord[] = [];
  
  for await (const entry of dirHandle.values()) {
    const relativePath = path ? `${path}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file') {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      files.push({
        id: crypto.randomUUID(),
        name: entry.name,
        size: file.size,
        type: file.type || 'unknown',
        handle: fileHandle,
        path: relativePath,
        lastModified: file.lastModified
      });
    } else if (entry.kind === 'directory') {
      // Recursive scan (optional, can be toggleable but useful for 'Downloads')
      const subDirHandle = entry as FileSystemDirectoryHandle;
      const subFiles = await scanDirectory(subDirHandle, relativePath);
      files = [...files, ...subFiles];
    }
  }
  return files;
};

// Helper to move file (Copy + Delete fallback if move() not supported)
export const moveFile = async (
  fileRecord: FileRecord, 
  targetFolder: string, 
  rootDirHandle: FileSystemDirectoryHandle
) => {
  try {
    // 1. Resolve/Create target directory
    const parts = targetFolder.split('/').filter(p => p);
    let currentDir = rootDirHandle;
    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, { create: true });
    }

    // 2. Try experimental move first (Chrome/Edge)
    if (fileRecord.handle.move) {
      // NOTE: move() signature varies in polyfills, but native is usually handle.move(dest)
      // Check if we can move into the directory
       try {
         // @ts-ignore - Experimental API
         await fileRecord.handle.move(currentDir);
         return true;
       } catch (e) {
         // Fallback if move to dir fails or isn't supported like that
       }
    }

    // 3. Fallback: Copy and Delete
    const file = await fileRecord.handle.getFile();
    const newFileHandle = await currentDir.getFileHandle(fileRecord.name, { create: true });
    const writable = await newFileHandle.createWritable();
    await writable.write(file);
    await writable.close();
    
    // 4. Delete original
    // We need the parent handle of the original file to remove it. 
    // This is tricky in a flat recursive scan without keeping parent refs.
    // For this specific 'Sort Download Folder' usecase, we often start from root.
    // If the file was in a subdir, we need to traverse to delete.
    
    // Simplification: We only support deleting if we can resolve the path from root.
    // Ideally we would pass the parent handle in FileRecord, but for now let's assume flat or
    // we traverse to find parent.
    
    // To properly remove, we need to find the parent directory handle of the *source* file
    const pathParts = fileRecord.path.split('/');
    pathParts.pop(); // remove filename
    let sourceParent = rootDirHandle;
    for (const part of pathParts) {
       sourceParent = await sourceParent.getDirectoryHandle(part);
    }
    await sourceParent.removeEntry(fileRecord.name);
    
    return true;

  } catch (err) {
    console.error(`Failed to move ${fileRecord.name}`, err);
    throw err;
  }
};
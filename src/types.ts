export interface Folder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FileItem {
  id: string;
  name: string;
  folder_id: string | null;
  r2_key: string;
  size_bytes: number;
  mime_type: string;
  created_at: string;
  updated_at: string;
}

export interface Breadcrumb {
  id: string;
  name: string;
}

export interface ItemsResponse {
  currentFolder: Folder | null;
  breadcrumbs: Breadcrumb[];
  folders: Folder[];
  files: FileItem[];
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

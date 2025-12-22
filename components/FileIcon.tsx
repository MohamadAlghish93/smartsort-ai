import React from 'react';
import { FileText, Image, Music, Video, FileCode, Archive, File as FileGeneric, ShieldAlert } from 'lucide-react';

interface FileIconProps {
  type: string;
  name: string;
  isSensitive?: boolean;
  className?: string;
}

const FileIcon: React.FC<FileIconProps> = ({ type, name, isSensitive, className = "w-6 h-6" }) => {
  if (isSensitive) return <ShieldAlert className={`${className} text-red-500`} />;

  const ext = name.split('.').pop()?.toLowerCase();

  if (type.startsWith('image/') || ['jpg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
    return <Image className={`${className} text-purple-400`} />;
  }
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext || '')) {
    return <Video className={`${className} text-red-400`} />;
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext || '')) {
    return <Music className={`${className} text-pink-400`} />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '')) {
    return <Archive className={`${className} text-yellow-400`} />;
  }
  if (['js', 'ts', 'tsx', 'html', 'css', 'json', 'py'].includes(ext || '')) {
    return <FileCode className={`${className} text-blue-400`} />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) {
    return <FileText className={`${className} text-green-400`} />;
  }

  return <FileGeneric className={`${className} text-gray-400`} />;
};

export default FileIcon;
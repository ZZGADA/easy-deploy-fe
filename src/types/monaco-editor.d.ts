declare module '@monaco-editor/react' {
  import { FC, ReactNode } from 'react';

  interface EditorProps {
    height?: string | number;
    width?: string | number;
    value?: string;
    defaultValue?: string;
    language?: string;
    defaultLanguage?: string;
    theme?: string;
    options?: any;
    loading?: ReactNode;
    onChange?: (value: string | undefined) => void;
    onMount?: (editor: any, monaco: any) => void;
    beforeMount?: (monaco: any) => void;
  }

  const Editor: FC<EditorProps>;
  export default Editor;
} 
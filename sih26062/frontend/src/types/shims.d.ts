// Minimal type shims to keep the project compiling in a lightweight scaffold.
// We intentionally avoid pulling in full @types/* packages during hackathon prototyping.

declare module 'react' {
  export type ReactNode = any;
  export type FC<P = any> = (props: P) => any;

  export function useState<T = any>(initial: T): [T, (v: T) => void];
  export function useEffect(effect: any, deps?: any[]): void;

  const React: any;
  export default React;
}

declare module 'react/jsx-runtime' {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}

declare module 'react-dom/client' {
  export const createRoot: any;
}

declare module 'react-router-dom' {
  export const BrowserRouter: any;
  export const Routes: any;
  export const Route: any;
  export const Navigate: any;
  export function useNavigate(): any;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

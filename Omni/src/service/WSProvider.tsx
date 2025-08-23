// import { tokenStorage } from "../store/storage";
// import { createContext, useContext, useEffect, useRef, useState } from "react";
// import { io, Socket } from "socket.io-client";
// import { SOCKET_URL } from "./config";
// import { refresh_token } from "./apiIntereptors";
// import AsyncStorage from '@react-native-async-storage/async-storage';
// interface WSService {
//     initializeSocket: () => void;
//     emit: (event: string, data?: any) => void;
//     on: (event: string, cb: (data: any) => void) => void;
//     off: (event: string) => void;
//     removeListener: (listenerName: string) => void;
//     updateAccessToken: (token: string) => void;

//     accessToken: string | null;
//     disconnect: () => void;
// }

// const WSContext = createContext<WSService | undefined>(undefined);

// export const WSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

//     const [socketAccesToken, setSocketAccessToken] = useState<string | null>(null);
//     const socket = useRef<Socket | null>(null);//replace by const socket = useRef<Socket>();
//     const [accessToken, setAccessToken] = useState<string | null>(null);
//     useEffect(() => {
//         const token = tokenStorage.getString("accessToken") as any;
//         setSocketAccessToken(token);
//     }, []);

//     useEffect(() => {
//         if (socketAccesToken) {
//             if (socket.current) {
//                 socket.current.disconnect();
//             }
//             socket.current = io(SOCKET_URL, {
//                 transports: ["websocket"],
//                 withCredentials: true,
//                 extraHeaders: {
//                     access_token: socketAccesToken || "",
//                 },
//             });

//             socket.current.on("connect error", (error) => {
//                 if (error.message === "Authentication error") {
//                     console.error("Auth Connection Error:", error.message);
//                     refresh_token();

//                 }
//             });
//         }
//         return () => {
//             socket.current?.disconnect();
//         }
//     }, [socketAccesToken]);


//     const emit = (event: string, data: any = {}) => {
//         socket.current?.emit(event, data);
//     };
//     const on = (event: string, cb: (data: any) => void) => {
//         socket.current?.on(event, cb);
//     };

//     const off = (event: string) => {
//         socket.current?.off(event);
//     };

//     const removeListener = (listenerName: string) => {
//         socket.current?.removeListener(listenerName);
//     };

//     const disconnect = () => {
//         if (socket.current) {
//             socket.current.disconnect();
//             socket.current = null;//earlier :socket.current = undefined;
//         }
//     };
//     // const updateAccessToken = (token: string) => {
//     //     const token = tokenStorage.getString("access_token");
//     //     setSocketAccessToken(token ?? null);//earlier :setSocketAccessToken(token);
//     // };
//     const updateAccessToken = async (token: string) => {
//         setAccessToken(token);
//         await AsyncStorage.setItem('accessToken', token);
//         console.log('token is : ', token)
//         // Optionally, persist token to AsyncStorage here
//     };

//     const socketService = {
//         initializeSocket: () => { },
//         emit,
//         on,
//         off,
//         disconnect,
//         removeListener,
//         updateAccessToken,
//         accessToken
//     };

//     return (
//         <WSContext.Provider value={socketService}>
//             {children}
//         </WSContext.Provider>
//     )
// }


// export const UseWS = () => {
//     const socketService = useContext(WSContext);
//     if (!socketService) {
//         throw new Error("useWS must be used within a WSProvider");
//     }
//     return socketService;
// };
// ...existing code...
import { tokenStorage } from "../store/storage";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { SOCKET_URL } from "./config";
import { refresh_token } from "./apiIntereptors";
import AsyncStorage from '@react-native-async-storage/async-storage';
interface WSService {
  initializeSocket: () => void;
  emit: (event: string, data?: any) => void;
  on: (event: string, cb: (data: any) => void) => void;
  off: (event: string) => void;
  removeListener: (listenerName: string) => void;
  updateAccessToken: (token: string) => void;

  accessToken: string | null;
  disconnect: () => void;

  // expose the raw socket so callers can read socket.id, etc.
  socket?: Socket | null;
}

const WSContext = createContext<WSService | undefined>(undefined);

export const WSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socketAccesToken, setSocketAccessToken] = useState<string | null>(null);
  const socket = useRef<Socket | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // helper: read token from multiple possible places
  const readStoredToken = async () => {
    try {
      // try tokenStorage first (synchronous if available)
      try {
        const t1 = (tokenStorage as any)?.getString?.('accessToken') || (tokenStorage as any)?.getString?.('token');
        if (t1) {
          console.log('[WSProvider] tokenStorage provided token (sync)');
          return t1;
        }
      } catch (e) {
        console.warn('[WSProvider] tokenStorage read failed', e);
      }
      // fallback to AsyncStorage
      const a = await AsyncStorage.getItem('accessToken');
      if (a) {
        console.log('[WSProvider] AsyncStorage accessToken found');
        return a;
      }
      const b = await AsyncStorage.getItem('token');
      if (b) {
        console.log('[WSProvider] AsyncStorage token found');
        return b;
      }
      return null;
    } catch (err) {
      console.warn('[WSProvider] readStoredToken error', err);
      return null;
    }
  };

  // create socket using the provided token in auth (socket.io v3/v4 recommended practice)
  const createSocket = (token?: string | null) => {
    try {
      console.log('[WSProvider] creating socket connection, token present:', !!token);
      // disconnect old socket if exists
      if (socket.current) {
        try {
          socket.current.disconnect();
          console.log('[WSProvider] disconnected previous socket');
        } catch (e) { console.warn('[WSProvider] previous socket disconnect error', e); }
        socket.current = null;
      }

      socket.current = io(SOCKET_URL, {
        transports: ['websocket'],
        auth: {
          token: token || ''
        },
        autoConnect: true,
        reconnection: true,
      });

      socket.current.on('connect', () => {
        console.log('[WSProvider] socket connected id=', socket.current?.id);
      });
      socket.current.on('connect_error', (err: any) => {
        console.error('[WSProvider] socket connect_error', err?.message || err);
      });
      socket.current.on('disconnect', (reason) => {
        console.log('[WSProvider] socket disconnected', reason);
      });
    } catch (e) {
      console.warn('[WSProvider] createSocket error', e);
    }
  };

  // initialize once: read token and connect
  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await readStoredToken();
      if (!mounted) return;
      setAccessToken(t);
      createSocket(t);
    })();
    return () => { mounted = false; };
  }, []);

  const emit = (event: string, data: any = {}) => {
    if (!socket.current) {
      console.warn('[WSProvider] emit called but socket not ready', event);
      return;
    }
    socket.current.emit(event, data);
  };
  const on = (event: string, cb: (data: any) => void) => {
    socket.current?.on(event, cb);
  };
  const off = (event: string) => {
    socket.current?.off(event);
  };
  const removeListener = (listenerName: string) => {
    socket.current?.removeListener(listenerName);
  };
  const disconnect = () => {
    socket.current?.disconnect();
    socket.current = null;
  };

  // update token and reconnect socket with new auth token
  const updateAccessToken = async (token: string) => {
    try {
      console.log('[WSProvider] updateAccessToken called, token present:', !!token);
      setAccessToken(token);
      await AsyncStorage.setItem('accessToken', token);
      try { (tokenStorage as any)?.setString?.('accessToken', token); } catch (e) { console.warn('[WSProvider] tokenStorage.setString failed', e); }
      // Recreate socket with new auth token so server middleware receives it
      createSocket(token);
    } catch (err) {
      console.warn('[WSProvider] updateAccessToken error', err);
    }
  };

  const socketService: WSService = {
    initializeSocket: () => createSocket(accessToken),
    emit,
    on,
    off,
    disconnect,
    removeListener,
    updateAccessToken,
    accessToken,
    socket: socket.current ?? null
  };

  return (
    <WSContext.Provider value={socketService}>
      {children}
    </WSContext.Provider>
  );
};

export const UseWS = () => {
  const socketService = useContext(WSContext);
  if (!socketService) throw new Error('useWS must be used within WSProvider');
  return socketService;
};
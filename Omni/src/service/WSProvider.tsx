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
    useEffect(() => {
        const token = tokenStorage.getString("accessToken") as any;
        setSocketAccessToken(token);
    }, []);

    useEffect(() => {
        if (socketAccesToken) {
            if (socket.current) {
                socket.current.disconnect();
            }
            socket.current = io(SOCKET_URL, {
                transports: ["websocket"],
                withCredentials: true,
                extraHeaders: {
                    access_token: socketAccesToken || "",
                },
            });

            socket.current.on("connect error", (error) => {
                if ((error as any).message === "Authentication error") {
                    console.error("Auth Connection Error:", (error as any).message);
                    refresh_token();
                }
            });
        }
        return () => {
            socket.current?.disconnect();
        }
    }, [socketAccesToken]);


    const emit = (event: string, data: any = {}) => {
        socket.current?.emit(event, data);
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
        if (socket.current) {
            socket.current.disconnect();
            socket.current = null;
        }
    };

    const updateAccessToken = async (token: string) => {
        setAccessToken(token);
        await AsyncStorage.setItem('accessToken', token);
        try {
            tokenStorage.set('accessToken', token);
        } catch (e) {
            console.warn('[WSProvider] tokenStorage.setString failed', e);
        }
        setSocketAccessToken(token);
        console.log('[WSProvider] updateAccessToken saved token and set socketAccesToken');
    };

    const socketService: WSService = {
        initializeSocket: () => { /* no-op or implement if needed */ },
        emit,
        on,
        off,
        disconnect,
        removeListener,
        updateAccessToken,
        accessToken,
        // expose current socket instance
        socket: socket.current ?? null
    };

    return (
        <WSContext.Provider value={socketService}>
            {children}
        </WSContext.Provider>
    )
}


export const UseWS = () => {
    const socketService = useContext(WSContext);
    if (!socketService) {
        throw new Error("useWS must be used within a WSProvider");
    }
    return socketService;
};
// ...existing code...
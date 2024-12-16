import React, { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Mic, StopCircle } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import logo from '../assets/logo.svg';
import talkingAnimation from '../assets/82jkQElwGr.json';

import './ConsolePage.scss';
import Lottie, { useLottie } from 'lottie-react';

import * as CryptoJS from 'crypto-js';

/**
 * Type for result from get_weather() function call
 */
interface Coordinates {
  lat: number;
  lng: number;
  location?: string;
  temperature?: {
    value: number;
    units: string;
  };
  wind_speed?: {
    value: number;
    units: string;
  };
}

/**
 * Type for all event logs
 */
interface RealtimeEvent {
  time: string;
  source: 'client' | 'server';
  count?: number;
  event: { [key: string]: any };
}

export function ConsolePage() {
  
  // API Key from environment
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;

  // Refs for key components
  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 })
  );
  const clientRef = useRef<RealtimeClient>(
    new RealtimeClient({
      apiKey: process.env.REACT_APP_OPENAI_API_KEY,
      dangerouslyAllowAPIKeyInBrowser: true,
    })
  );

  // Canvas and scroll refs
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  // State variables
  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

  // Animation states
  const [isTalking, setIsTalking] = useState(false);
  const { View, play, stop } = useLottie({
    animationData: talkingAnimation,
    loop: true,
    autoplay: false,
  });

  // Utility function to format time
  const formatTime = useCallback((timestamp: string) => {
    const startTime = startTimeRef.current;
    const t0 = new Date(startTime).valueOf();
    const t1 = new Date(timestamp).valueOf();
    const delta = t1 - t0;
    const hs = Math.floor(delta / 10) % 100;
    const s = Math.floor(delta / 1000) % 60;
    const m = Math.floor(delta / 60_000) % 60;
    const pad = (n: number) => {
      let s = n + '';
      while (s.length < 2) {
        s = '0' + s;
      }
      return s;
    };
    return `${pad(m)}:${pad(s)}.${pad(hs)}`;
  }, []);

  // Connect conversation method
  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setIsTalking(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    // console.log(setItems);

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();

    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello`,
      },
    ]);

    client.updateSession({
      turn_detection: { type: 'server_vad' }
    });

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  // Disconnect conversation method with full conversation saving
  const disconnectConversation = useCallback(async () => {
    setIsConnected(false);
    setRealtimeEvents([]);
    setItems([]);
    setMemoryKv({});
    setCoords({
      lat: 37.775593,
      lng: -122.418137,
    });
    setMarker(null);
    
    const client = clientRef.current;
    
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();
    
    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
    
    const conversationItems = client.conversation.getItems();
    let tempArray:any = [];
    conversationItems.map((items:any)=>{
      tempArray.push({
        role:items.role,
        message:items.content
      })
    })
    console.log(tempArray)
    stop();
    saveuserResponse(tempArray);
    // disconnect here 
    client.disconnect();
  }, []);
  
  // Send full conversation to API
  // const sendFullConversationToAPI = async (data:any) => {
  //   const conversationToSend = items.map((item, index) => ({
  //     sequence: index + 1,
  //     role: item.role,
  //     message: item.formatted.text || item.formatted.transcript || '',
  //     timestamp: new Date().toISOString()
  //   }));

  //   try {
  //     const response = await fetch('http://localhost:3001/save-conversation', {
  //       method: 'POST',
  //       headers: {
  //         'Content-Type': 'application/json'
  //       },
  //       body: JSON.stringify(data)
  //     });

  //     const result = await response.json();
  //     console.log('Full conversation saved:', result);
  //   } catch (error) {
  //     console.error('Error sending full conversation:', error);
  //   }
  // };

  // Save individual user response
  const saveuserResponse = async (data: any) => {
    console.log('dataaaaaaaaaaaaaaaaaaaaaaaaaa',data);
    const payload = {
      formatted:data
    }
    console.log
    try {
      const response = await fetch('http://35.86.170.109:3001/save-conversation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if(response.status === 200){
        const result = await response.json();
        if (result) {
          console.log(result.patient_details.name);
          const createPatientPayload = {name:result.patient_details.name, id:null};
          createPatient(createPatientPayload)
        }
      }
    } catch (error) {
      console.error('Error saving user response:', error);
    }
  };
  const [accumulatedItems, setAccumulatedItems] = useState<ItemType[]>([]);

  const createPatient = async (payload:{name:string, id:string|null})=>{
    const  response = await (await fetch('https://stage-api.healthorbit.ai/api/v1/add-patient/separate',{
      method:"POST",
      body:JSON.stringify(payload),
      headers:{
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${decryptToken(window.location.href.split('key=')[1])}`
      }
    })).json();
    if(response){
      console.log(response);
    }
  }


  const decryptToken = (data:string)=>{
    try {
      console.log(data)
      const bytes = CryptoJS.AES.decrypt(data, 'YOUR_CRYPTO_SECRET_KEY');
      const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
      if (!decryptedData) {
        throw new Error('Decryption failed: Malformed UTF-8 data');
      }
      return JSON.parse(decryptedData);
    } catch (error) {
      return null;
    }
  }

  useEffect(()=>{
    console.log(decryptToken(window.location.href.split('key=')[1]))
  },[])


  
//   const saveuserResponse = async (data: any) => {
//     const transcript = data?.formatted?.transcript;

//     if (!transcript) {
//         console.warn('Transcript is empty or null. Skipping API call.');
//         return;
//     }

//     try {
//         const response = await fetch('http://localhost:3001/save-conversation', {
//             method: 'POST',
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//             body: JSON.stringify({ formatted: { transcript } }),
//         });
//         const result = await response.json();
//         if (result) {
//             console.log(result);
//         }
//     } catch (error) {
//         console.error('Error saving user response:', error);
//     }
// };

  // Store conversation in database
  const storeInDataBase = (items: Array<any> | undefined) => {
    if (items?.length) {
      items.forEach((data: any) => {
        if (data.role === "user") {
          saveuserResponse(data);
        }
      });
    }
  };

  // Animation effect based on conversation items
  useEffect(() => {
    if (items.length) {
      const lastItem = items[items.length - 1];
      if (lastItem.role === 'assistant') {
        play();
      } else if (lastItem.role === 'user') {
        stop();
      }
    }
  }, [items, play, stop]);

  // Client and conversation setup effect
  useEffect(() => {
    const client = clientRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    client.updateSession({ instructions: instructions });
    client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

    client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
      setRealtimeEvents((realtimeEvents) => {
        const lastEvent = realtimeEvents[realtimeEvents.length - 1];
        if (lastEvent?.event.type === realtimeEvent.event.type) {
          lastEvent.count = (lastEvent.count || 0) + 1;
          return realtimeEvents.slice(0, -1).concat(lastEvent);
        } else {
          return realtimeEvents.concat(realtimeEvent);
        }
      });
    });

    client.on('error', (event: any) => console.error(event));
    client.on('conversation.interrupted', async () => {
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    client.on('conversation.updated', async ({ item, delta }: any) => {
      const items = client.conversation.getItems();
      
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000
        );
        item.formatted.file = wavFile;
      }
      
      setItems(items);
    });

    setItems(client.conversation.getItems());

    return () => {
      client.reset();
    };
  }, []);

  // Rendering
  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src={logo} alt="logo" />
          <span className='tittle'>Healthorbit copilot</span>
        </div>conversation
      </div>
      
      <div className="content-main">
        <div className="content-logs">
          <div className="asistant-wrapper">
            <div className="content-actions">
              <div>{View}</div>
              
              <div className='frame'>
                <div className="dr-tile">Hello...</div>
                <div className="dr-description mb-3">
                  Welcome to nurse co-pilot.....How can I help you....?
                </div>
              </div>
              
              <Button
                label={isConnected ? '' : ''}
                iconPosition={isConnected ? 'end' : 'start'}
                icon={isConnected ? StopCircle : Mic}
                buttonStyle={isConnected ? 'regular' : 'action'}
                className='pushtoTalkButton'
                onClick={
                  isConnected ? disconnectConversation : connectConversation
                }
              />
            </div>
            
            <div className="content-block conversation">
              <div className="content-block-body" data-conversation-content>
                {!items.length && `Awaiting connection...`}
                {items.map((conversationItem) => (
                  <div 
                    className="conversation-item" 
                    key={conversationItem.id}
                  >
                    <div className={`speaker ${conversationItem.role || ''}`}>
                      <div>
                        {(
                          conversationItem.role || conversationItem.type
                        ).replaceAll('_', ' ')}
                      </div>
                      <div
                        className="close"
                        onClick={() => {
                          const client = clientRef.current;
                          client.deleteItem(conversationItem.id);
                        }}
                      >
                        <X />
                      </div>
                    </div>
                    
                    <div className={`speaker-content ${conversationItem.role}`}>
                      {conversationItem.type === 'function_call_output' && (
                        <div>{conversationItem.formatted.output}</div>
                      )}
                      
                      {!!conversationItem.formatted.tool && (
                        <div>
                          {conversationItem.formatted.tool.name}(
                          {conversationItem.formatted.tool.arguments})
                        </div>
                      )}
                      
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'user' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              (conversationItem.formatted.audio?.length
                                ? '(awaiting transcript)'
                                : conversationItem.formatted.text ||
                                '(item sent)')}
                          </div>
                        )}
                      
                      {!conversationItem.formatted.tool &&
                        conversationItem.role === 'assistant' && (
                          <div>
                            {conversationItem.formatted.transcript ||
                              conversationItem.formatted.text ||
                              '(truncated)'}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
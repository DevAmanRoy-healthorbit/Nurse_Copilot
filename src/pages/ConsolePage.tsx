const LOCAL_RELAY_SERVER_URL: string =
  process.env.REACT_APP_LOCAL_RELAY_SERVER_URL || '';

const OPENAI_KEY = process.env.REACT_APP_OPENAI_API_KEY || '';

import { useEffect, useRef, useCallback, useState } from 'react';

import { RealtimeClient } from '@openai/realtime-api-beta';
import { ItemType } from '@openai/realtime-api-beta/dist/lib/client.js';
import { WavRecorder, WavStreamPlayer } from '../lib/wavtools/index.js';
import { instructions } from '../utils/conversation_config.js';
import { WavRenderer } from '../utils/wav_renderer';

import { X, Edit, Zap, ArrowUp, ArrowDown, Mic, StopCircle, Pause } from 'react-feather';
import { Button } from '../components/button/Button';
import { Toggle } from '../components/toggle/Toggle';
import logo from '../assets/logo.svg';
import demoImage from '../assets/frame-view.png';

import talkingAnimation from '../assets/82jkQElwGr.json';
import idleAnimation from '../assets/nurseIdle.svg';




// import { Map } from '../components/Map';

import './ConsolePage.scss';
import { isJsxOpeningLikeElement } from 'typescript';
import Lottie, { useLottie } from 'lottie-react';

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

  /**
   * Ask user for API Key
   * If we're using the local relay server, we don't need this
   */
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY

  /**
   * Instantiate:
   * - WavRecorder (speech input)
   * - WavStreamPlayer (speech output)
   * - RealtimeClient (API client)
   */
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


  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const eventsScrollHeightRef = useRef(0);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<string>(new Date().toISOString());

  const [items, setItems] = useState<ItemType[]>([]);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<{
    [key: string]: boolean;
  }>({});
  const [isConnected, setIsConnected] = useState(false);
  const [canPushToTalk, setCanPushToTalk] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
  const [coords, setCoords] = useState<Coordinates | null>({
    lat: 37.775593,
    lng: -122.418137,
  });
  const [marker, setMarker] = useState<Coordinates | null>(null);

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

  const resetAPIKey = useCallback(() => {
    const apiKey = prompt('OpenAI API Key');
    if (apiKey !== null) {
      localStorage.clear();
      localStorage.setItem('tmp::voice_api_key', apiKey);
      window.location.reload();
    }
  }, []);

  const connectConversation = useCallback(async () => {
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    startTimeRef.current = new Date().toISOString();
    setIsConnected(true);
    setIsTalking(true);
    setRealtimeEvents([]);
    setItems(client.conversation.getItems());

    await wavRecorder.begin();

    await wavStreamPlayer.connect();

    await client.connect();
    client.sendUserMessageContent([
      {
        type: `input_text`,
        text: `Hello!`,
      },
    ]);

    client.updateSession({
      turn_detection: { type: 'server_vad' }
    })

    if (client.getTurnDetectionType() === 'server_vad') {
      await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    }
  }, []);

  const disconnectConversation = useCallback(async () => {
    stop();
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
    client.disconnect();

    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.end();

    const wavStreamPlayer = wavStreamPlayerRef.current;
    await wavStreamPlayer.interrupt();
  }, []);

  const deleteConversationItem = useCallback(async (id: string) => {
    const client = clientRef.current;
    client.deleteItem(id);
  }, []);

  const startRecording = async () => {
    setIsRecording(true);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));
  };

  const stopRecording = async () => {
    setIsRecording(false);
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    await wavRecorder.pause();
    client.createResponse();
  };
  const changeTurnEndType = async (value: string) => {
    // console.log(value, "value")
    // const client = clientRef.current;
    // const wavRecorder = wavRecorderRef.current;
    // if (value === 'none' && wavRecorder.getStatus() === 'recording') {
    //   await wavRecorder.pause();
    // }
    // client.updateSession({
    //   turn_detection: value === 'none' ? null : { type: 'server_vad' },
    // });
    // if (value === 'server_vad' && client.isConnected()) {
    //   await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    // }
    // setCanPushToTalk(value === 'none');
  };
  useEffect(() => {
    if (eventsScrollRef.current) {
      const eventsEl = eventsScrollRef.current;
      const scrollHeight = eventsEl.scrollHeight;
      // Only scroll if height has just changed
      if (scrollHeight !== eventsScrollHeightRef.current) {
        eventsEl.scrollTop = scrollHeight;
        eventsScrollHeightRef.current = scrollHeight;
      }
    }
  }, [realtimeEvents]);

  useEffect(() => {
    const conversationEls = [].slice.call(
      document.body.querySelectorAll('[data-conversation-content]')
    );
    for (const el of conversationEls) {
      const conversationEl = el as HTMLDivElement;
      conversationEl.scrollTop = conversationEl.scrollHeight;
    }
  }, [items]);
  useEffect(() => {
    let isLoaded = true;

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    let clientCtx: CanvasRenderingContext2D | null = null;

    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;
    let serverCtx: CanvasRenderingContext2D | null = null;

    const render = () => {
      if (isLoaded) {
        if (clientCanvas) {
          if (!clientCanvas.width || !clientCanvas.height) {
            clientCanvas.width = clientCanvas.offsetWidth;
            clientCanvas.height = clientCanvas.offsetHeight;
          }
          clientCtx = clientCtx || clientCanvas.getContext('2d');
          if (clientCtx) {
            clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            const result = wavRecorder.recording
              ? wavRecorder.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              clientCanvas,
              clientCtx,
              result.values,
              '#0099ff',
              10,
              0,
              8
            );
          }
        }
        if (serverCanvas) {
          if (!serverCanvas.width || !serverCanvas.height) {
            serverCanvas.width = serverCanvas.offsetWidth;
            serverCanvas.height = serverCanvas.offsetHeight;
          }
          serverCtx = serverCtx || serverCanvas.getContext('2d');
          if (serverCtx) {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
            const result = wavStreamPlayer.analyser
              ? wavStreamPlayer.getFrequencies('voice')
              : { values: new Float32Array([0]) };
            WavRenderer.drawBars(
              serverCanvas,
              serverCtx,
              result.values,
              '#009900',
              10,
              0,
              8
            );
          }
        }
        window.requestAnimationFrame(render);
      }
    };
    render();

    return () => {
      isLoaded = false;
    };
  }, []);

  useEffect(() => {
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const client = clientRef.current;
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
      storeInDataBase(items);
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


  const storeInDataBase = (items: Array<any> | undefined) => {
    console.log(items, "items");
    if (items?.length) {
      items.forEach((data: any) => {
        switch (data.role) {
          case "user":
            // console.log(data);
            saveuserResponse(data);
            break;
          case "assistant":
            // console.log(data);
            break;
        }
      })
    }

  }

  const saveuserResponse = async (data:any) =>{
    console.log(data, "data")
    const response = await fetch('http://localhost:3001/save-conversation',{
      method:'POST',
      headers:{
         'Content-Type': 'application/json'
      },
      body:JSON.stringify(data)
    });
    const result = await response.json();
    if(result){
      console.log(result);
    }
  }



 


  // animation handle 

  // Animation state and logic
  const [isTalking, setIsTalking] = useState(false);
  const currentRoleRef = useRef<string | null>(null);

  const { View, play, stop } = useLottie({
    animationData: talkingAnimation,
    loop: true,
    autoplay: false, // Controlled manually
  });

  useEffect(() => {
    if (items.length) {
      // Find the last item in the array
      const lastItem = items[items.length - 1];

      if (lastItem.role === 'assistant') {
        play(); // Play animation if role is 'assistant'
      } else if (lastItem.role === 'user') {
        stop(); // Stop animation if role is 'user'
      }
    }
  }, [items, play, stop]);

  // Debugging
  useEffect(() => {
    console.log('Talking animation state:', isTalking);
  }, [isTalking]);

  // const startRecording = async () => {
  //   setIsTalking(true);
  //   // Your existing recording logic here
  // };

  // const stopRecording = async () => {
  //   setIsTalking(false);
  //   // Your existing stop recording logic here
  // };

  return (
    <div data-component="ConsolePage">
      <div className="content-top">
        <div className="content-title">
          <img src={logo} alt="logo" />
          <span className='tittle'>Healthorbit copilot
          </span>
        </div>
        {/* <div className="content-api-key" style={{ display: "none", }}>
          {!LOCAL_RELAY_SERVER_URL && (
            <Button
              icon={Edit}
              iconPosition="end"
              buttonStyle="flush"
              label={`api key: ${apiKey.slice(0, 3)}...`}
              onClick={() => resetAPIKey()}
            />
          )}
        </div> */}
      </div>
      <div className="content-main">
        <div className="content-logs">

          <div className="asistant-wrapper">
            <div className="content-actions">

              <div>
                {View}
              </div>
              <div className='frame'>
                {/* <img src={demoImage} /> */}
                <div className="dr-tile">Hello...</div>
                <div className="dr-description mb-3">Welcome to nurse co-pilot.....How can i help you....?</div></div>
              {/* <div className='toggle'>
            <Toggle
              defaultValue={true}
              labels={['Manual', 'Automated']}
              values={['none', 'server_vad']}
              onChange={(_, value) => changeTurnEndType(value)}
            /></div> */}
              {/* <div className="spacer" />
            {isConnected && canPushToTalk && (
              <Button
                label={isRecording ? 'release to send' : 'push to talk'}
                buttonStyle={isRecording ? 'alert' : 'regular'}
                disabled={!isConnected || !canPushToTalk}
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
              />
            )} */}
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
              {/* <div className="content-block-title">conversation</div> */}
              <div className="content-block-body" data-conversation-content>
                {!items.length && `awaiting connection...`}
                {items.map((conversationItem, i) => {
                  return (
                    <div className="conversation-item" key={conversationItem.id}>
                      <div className={`speaker ${conversationItem.role || ''}`}>
                        <div>
                          {(
                            conversationItem.role || conversationItem.type
                          ).replaceAll('_', ' ')}
                        </div>
                        <div
                          className="close"
                          onClick={() =>
                            deleteConversationItem(conversationItem.id)
                          }
                        >
                          <X />
                        </div>
                      </div>
                      <div className={`speaker-content ${conversationItem.role}`}>
                        {/* tool response */}
                        {conversationItem.type === 'function_call_output' && (
                          <div>{conversationItem.formatted.output}</div>
                        )}
                        {/* tool call */}
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
                        {/* {conversationItem.formatted.file && (
                        <audio
                          src={conversationItem.formatted.file.url}
                          controls
                        />
                      )} */}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}

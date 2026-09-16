import { useEffect, useRef, useState } from 'react';

const VECTOR_PASSES = [
  ['scene', '/animation/cybersecurity/cybersecurity-scene.svg'],
] as const;
const REQUIRED_NODES = ['threat_display', 'health_display', 'operations_display', 'camera_head', 'secure_door_leaf', 'server_rack_middle_door', 'reference_binder_3'];

const SCENE_CSS = `
svg{width:100%;height:100%;display:block;overflow:hidden}
svg[data-paused="true"] *{animation-play-state:paused!important}
svg[data-motion="reduced"] *{animation:none!important;transition-duration:.001ms!important}
[data-motion="pulse"]{animation:cyberSignal 4s ease-in-out infinite}
#node_pulse_2,#node_pulse_6,#monitor_refresh_2,#monitor_refresh_5,#monitor_refresh_8{animation-delay:-1.3s}
#node_pulse_4,#node_pulse_8,#monitor_refresh_3,#monitor_refresh_6,#monitor_refresh_9{animation-delay:-2.7s}
#camera_head{transform-box:view-box;transform-origin:1347px 105px;animation:cyberCamera 13.5s cubic-bezier(.42,0,.28,1) infinite}
[data-motion="sway_small"]{transform-box:fill-box;transform-origin:50% 100%;animation:cyberFoliage 9s ease-in-out infinite}
#secure_door_leaf{transform-box:view-box;transform-origin:1620px 581px}
#secure_door_leaf{transition-duration:.65s}
#server_rack_left_door{transform-box:view-box;transform-origin:1310px 560px;transition-duration:.5s}
#server_rack_middle_door{transform-box:view-box;transform-origin:1353px 560px;transition-duration:.5s}
#server_rack_right_door{transform-box:view-box;transform-origin:1398px 560px;transition-duration:.5s}
#reference_binder_3{transform-box:view-box;transition-duration:.45s}
#console_chair_1,#console_chair_2,#console_chair_3{transform-box:view-box;transition-duration:.5s}
#health_row_networks_check,#health_row_endpoints_check,#health_row_applications_check,#health_row_data_check,#health_row_users_check{transition-duration:.35s}
#threat_display,#health_display,#operations_display,[id^="operations_row_"],[id^="monitor_"]{transition-duration:.42s;transition-timing-function:cubic-bezier(.2,.72,.24,1)}
[id^="console_1_left_cabinet_drawer_"]:is([id$="_1"],[id$="_2"],[id$="_3"]),[id^="console_1_right_cabinet_drawer_"]:is([id$="_1"],[id$="_2"],[id$="_3"]),[id^="console_2_left_cabinet_drawer_"]:is([id$="_1"],[id$="_2"],[id$="_3"]),[id^="console_2_right_cabinet_drawer_"]:is([id$="_1"],[id$="_2"],[id$="_3"]),[id^="console_3_left_cabinet_drawer_"]:is([id$="_1"],[id$="_2"],[id$="_3"]),[id^="console_3_right_cabinet_drawer_"]:is([id$="_1"],[id$="_2"],[id$="_3"]){transform-box:view-box;transition-duration:.4s}
svg[data-object-focus="console_chair_1"] #console_chair_1{transform:translate(-4px,4px);filter:brightness(1.06)}
svg[data-object-focus="console_chair_2"] #console_chair_2{transform:translate(0,4px);filter:brightness(1.06)}
svg[data-object-focus="console_chair_3"] #console_chair_3{transform:translate(4px,4px);filter:brightness(1.06)}
svg[data-object-focus*="_cabinet_drawer_"] [id^="console_"][id*="_cabinet_drawer_"]{transition-timing-function:cubic-bezier(.2,.72,.24,1)}
svg[data-object-focus="console_1_left_cabinet_drawer_1"] #console_1_left_cabinet_drawer_1,svg[data-object-focus="console_1_left_cabinet_drawer_2"] #console_1_left_cabinet_drawer_2,svg[data-object-focus="console_1_left_cabinet_drawer_3"] #console_1_left_cabinet_drawer_3,svg[data-object-focus="console_1_right_cabinet_drawer_1"] #console_1_right_cabinet_drawer_1,svg[data-object-focus="console_1_right_cabinet_drawer_2"] #console_1_right_cabinet_drawer_2,svg[data-object-focus="console_1_right_cabinet_drawer_3"] #console_1_right_cabinet_drawer_3,svg[data-object-focus="console_2_left_cabinet_drawer_1"] #console_2_left_cabinet_drawer_1,svg[data-object-focus="console_2_left_cabinet_drawer_2"] #console_2_left_cabinet_drawer_2,svg[data-object-focus="console_2_left_cabinet_drawer_3"] #console_2_left_cabinet_drawer_3,svg[data-object-focus="console_2_right_cabinet_drawer_1"] #console_2_right_cabinet_drawer_1,svg[data-object-focus="console_2_right_cabinet_drawer_2"] #console_2_right_cabinet_drawer_2,svg[data-object-focus="console_2_right_cabinet_drawer_3"] #console_2_right_cabinet_drawer_3,svg[data-object-focus="console_3_left_cabinet_drawer_1"] #console_3_left_cabinet_drawer_1,svg[data-object-focus="console_3_left_cabinet_drawer_2"] #console_3_left_cabinet_drawer_2,svg[data-object-focus="console_3_left_cabinet_drawer_3"] #console_3_left_cabinet_drawer_3,svg[data-object-focus="console_3_right_cabinet_drawer_1"] #console_3_right_cabinet_drawer_1,svg[data-object-focus="console_3_right_cabinet_drawer_2"] #console_3_right_cabinet_drawer_2,svg[data-object-focus="console_3_right_cabinet_drawer_3"] #console_3_right_cabinet_drawer_3{transform:translate(0,4px);filter:brightness(1.08)}
svg[data-focus="monitoring"] #threat_sweep,svg[data-focus="monitoring"] [id^="monitor_refresh_"],svg[data-selected="monitoring"] #threat_sweep,svg[data-selected="monitoring"] [id^="monitor_refresh_"]{animation:cyberMapSweep 1.45s ease-out 1 both;filter:brightness(1.35)}
svg[data-focus="monitoring"] #threat_display{filter:brightness(1.075) saturate(1.08)}
svg[data-focus="health"] #health_display{filter:brightness(1.11) saturate(1.12)}
svg[data-focus="health"] #health_row_networks_check,svg[data-focus="health"] #health_row_endpoints_check,svg[data-focus="health"] #health_row_applications_check,svg[data-focus="health"] #health_row_data_check,svg[data-focus="health"] #health_row_users_check{animation:cyberCheck 1.2s ease-in-out infinite alternate}
svg[data-selected="health"] #health_row_networks_check,svg[data-selected="health"] #health_row_endpoints_check,svg[data-selected="health"] #health_row_applications_check,svg[data-selected="health"] #health_row_data_check,svg[data-selected="health"] #health_row_users_check{animation:none;opacity:0}
svg[data-focus="response"] #operations_display{filter:brightness(1.1) saturate(1.12)}
svg[data-focus="response"] #operations_row_detect,svg[data-focus="response"] #operations_row_prevent,svg[data-focus="response"] #operations_row_respond,svg[data-focus="response"] #operations_row_continuity{animation:cyberResponse 1.5s ease-in-out infinite alternate}
svg[data-focus="response"] #camera_head,svg[data-selected="response"] #camera_head{animation:none;transform:rotate(9deg);transition-duration:.5s}
svg[data-focus="infrastructure"] #server_rack_left_door,svg[data-focus="infrastructure"] #server_rack_middle_door,svg[data-focus="infrastructure"] #server_rack_right_door,svg[data-selected="infrastructure"] #server_rack_left_door,svg[data-selected="infrastructure"] #server_rack_middle_door,svg[data-selected="infrastructure"] #server_rack_right_door{transform:scaleX(.83);filter:brightness(1.08)}
svg[data-focus="briefing"] #monitor_2_1,svg[data-focus="briefing"] #monitor_2_2,svg[data-focus="briefing"] #monitor_2_3,svg[data-selected="briefing"] #monitor_2_1,svg[data-selected="briefing"] #monitor_2_2,svg[data-selected="briefing"] #monitor_2_3{filter:brightness(1.16) saturate(1.1)}
svg[data-focus="process"] #reference_binder_3,svg[data-selected="process"] #reference_binder_3{transform:translate(8px,-2px);filter:brightness(1.08)}
svg[data-selected="return-lobby"] #secure_door_leaf{transform:scaleX(.1);filter:brightness(.9)}
svg[data-motion="reduced"] #threat_sweep,svg[data-motion="reduced"] [id^="monitor_refresh_"]{opacity:0!important}
@keyframes cyberSignal{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes cyberMapSweep{0%{opacity:0;transform:translateY(0)}12%{opacity:.72}82%{opacity:.25}100%{opacity:0;transform:translateY(183px)}}
@keyframes cyberCamera{0%,16%,100%{transform:rotate(0)}35%,48%{transform:rotate(-4.5deg)}68%,82%{transform:rotate(5.5deg)}}
@keyframes cyberFoliage{0%,100%{transform:rotate(-.22deg)}50%{transform:rotate(.22deg)}}
@keyframes cyberCheck{0%{opacity:.58;filter:brightness(1)}100%{opacity:1;filter:brightness(1.22)}}
@keyframes cyberResponse{0%{opacity:.68;filter:brightness(1)}100%{opacity:1;filter:brightness(1.16)}}
`;

interface Props {
  focus: string | null;
  selected: string | null;
  objectFocus: string | null;
  motion: boolean;
  onReady: () => void;
  onError: (error: unknown) => void;
}

/** Loads the supplied full vector as a same-origin SVG document so its named assemblies animate as actual independent objects. */
export default function CybersecurityVector({ focus, selected, objectFocus, motion, onReady, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const [documentReady, setDocumentReady] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);

  const applyState = () => {
    const roots = containerRef.current?.querySelectorAll<SVGSVGElement>('svg');
    if (!roots?.length) return;
    for (const root of roots) {
      root.dataset.focus = focus ?? '';
      root.dataset.selected = selected ?? '';
      root.dataset.objectFocus = objectFocus ?? '';
      root.dataset.motion = motion ? 'on' : 'reduced';
      root.dataset.paused = !motion || !visible || hidden ? 'true' : 'false';
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const controller = new AbortController();
    let active = true;

    Promise.all(VECTOR_PASSES.map(async ([name, src]) => {
      const response = await fetch(src, { signal: controller.signal });
      if (!response.ok) throw new Error(`Cybersecurity ${name} SVG request failed with ${response.status}.`);
      return [name, await response.text()] as const;
    }))
      .then(sources => {
        if (!active) return;
        const roots = sources.map(([name, source]) => {
          const parsed = new DOMParser().parseFromString(source, 'image/svg+xml');
          const parseError = parsed.querySelector('parsererror');
          const sourceRoot = parsed.documentElement;
          if (parseError || sourceRoot.localName !== 'svg') throw new Error(`Cybersecurity ${name} SVG could not be parsed.`);
          const root = document.importNode(sourceRoot, true) as unknown as SVGSVGElement;
          const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          style.id = `tdg-cybersecurity-${name}-runtime-style`;
          style.textContent = SCENE_CSS;
          root.prepend(style);
          root.classList.add('cybersecurity-vector-pass');
          root.dataset.pass = name;
          root.setAttribute('aria-hidden', 'true');
          root.setAttribute('focusable', 'false');
          return root;
        });
        container.replaceChildren(...roots);
        const missing = REQUIRED_NODES.filter(id => !container.querySelector(`#${id}`));
        if (missing.length) throw new Error(`Cybersecurity SVG contract missing: ${missing.join(', ')}`);
        setDocumentReady(true);
        callbacks.current.onReady();
      })
      .catch(error => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setDocumentReady(false);
        callbacks.current.onError(error);
      });

    return () => {
      active = false;
      controller.abort();
      container.replaceChildren();
    };
  }, []);

  useEffect(applyState, [documentReady, focus, hidden, motion, objectFocus, selected, visible]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      const entry = entries.find(candidate => candidate.target === element);
      if (entry) setVisible(entry.isIntersecting);
    }, { threshold: 0.02 });
    const handleVisibility = () => setHidden(document.hidden);
    observer.observe(element);
    document.addEventListener('visibilitychange', handleVisibility);
    handleVisibility();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="cybersecurity-vector"
      aria-hidden="true"
      data-ready={documentReady ? 'true' : 'false'}
    />
  );
}

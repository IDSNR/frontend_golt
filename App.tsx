import { StatusBar } from 'expo-status-bar';
import { useEvent } from 'expo';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Google from 'expo-auth-session/providers/google';
import * as SecureStore from 'expo-secure-store';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

function expoDevelopmentHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  const authority = hostUri.replace(/^https?:\/\//i, '').split('/')[0];
  const host = authority.startsWith('[')
    ? authority.slice(1, authority.indexOf(']'))
    : authority.split(':')[0];

  if (!host || ['localhost', '127.0.0.1', '0.0.0.0'].includes(host.toLowerCase())) return null;
  return host;
}

function resolveDevelopmentUrl(configuredUrl: string | undefined, fallbackPort: number): string {
  const configured = configuredUrl?.trim();
  const developmentHost = Platform.OS === 'web' ? null : expoDevelopmentHost();

  if (configured) {
    const localUrl = configured.match(/^(https?:\/\/|wss?:\/\/)(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i);
    if (localUrl && developmentHost) {
      return `${localUrl[1]}${developmentHost}${localUrl[3] || ''}${localUrl[4] || ''}`.replace(/\/$/, '');
    }
    return configured.replace(/\/$/, '');
  }

  if (developmentHost) return `http://${developmentHost}:${fallbackPort}`;
  if (Platform.OS === 'android') return `http://10.0.2.2:${fallbackPort}`;
  return `http://localhost:${fallbackPort}`;
}

const API_BASE_URL = resolveDevelopmentUrl(process.env.EXPO_PUBLIC_API_BASE_URL, 8000);
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const SESSION_STORAGE_KEY = 'partnerhub.session';
const REALTIME_URL = process.env.EXPO_PUBLIC_REALTIME_URL
  ? resolveDevelopmentUrl(process.env.EXPO_PUBLIC_REALTIME_URL, 8000)
  : `${API_BASE_URL.replace(/^http/, 'ws')}/realtime`;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

WebBrowser.maybeCompleteAuthSession();

type Tab = 'feed' | 'search' | 'groups' | 'dms' | 'profile';

type AffiliateOffer = {
  id: string;
  contentId: string;
  provider: 'amazon';
  merchantName: string;
  marketplace: string;
  title: string;
  disclosure: string;
  priceNotice: string;
  commissionTrackingActive: boolean;
};

type Post = {
  id: string;
  creatorId: string;
  caption?: string;
  videoUrl?: string | null;
  mediaItems?: Array<{ id: string; mediaType: string; url: string; orderIndex?: number }>;
  creatorHandle?: string;
  creatorDisplayName?: string;
  creatorAvatarUrl?: string;
  created_at?: string;
  views?: number;
  completions?: number;
  affiliateOffers?: AffiliateOffer[];
};

type Engagement = {
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  likedByViewer: boolean;
  bookmarkedByViewer: boolean;
};

type Story = {
  id: string;
  creatorId: string;
  mediaType: string;
  mediaUrl: string;
  created_at?: string;
};

type Profile = {
  id: string;
  handle: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  websiteUrl?: string | null;
  location?: string | null;
  pronouns?: string | null;
  isPrivate?: boolean;
  followerCount?: number;
  followingCount?: number;
  postCount?: number;
  relationshipStatus?: 'none' | 'following' | 'requested';
};

type Thread = {
  id: string;
  participantIds: string[];
  lastMessage: string;
  updatedAt: string;
};

type Group = {
  id: string;
  ownerId: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  created_at: string;
};

type GroupMember = {
  accountId: string;
  role: 'owner' | 'member' | 'pending';
};

type RouletteOption = {
  id: string;
  label: string;
  kind: string;
  probability: number;
  visualIndex: number;
};

type RouletteSession = {
  sessionId: number;
  options: RouletteOption[];
  engineVersion: string;
  visualSectorCount: number;
};

type NativeVideoPlayerProps = {
  uri: string;
  onPlay?: () => void;
};

function NativeVideoPlayer({ uri, onPlay }: NativeVideoPlayerProps) {
  const hasReportedPlay = useRef(false);
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  useEffect(() => {
    if (isPlaying && !hasReportedPlay.current) {
      hasReportedPlay.current = true;
      onPlay?.();
    }
  }, [isPlaying, onPlay]);

  return (
    <VideoView
      style={styles.nativeVideo}
      player={player}
      nativeControls
      contentFit="cover"
      fullscreenOptions={{ enable: true }}
      surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
    />
  );
}

export default function App() {
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('P@ssword123');
  const [displayName, setDisplayName] = useState('Demo User');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [feed, setFeed] = useState<Post[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [engagementByPost, setEngagementByPost] = useState<Record<string, Engagement>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [commentsByPost, setCommentsByPost] = useState<Record<string, any[]>>({});
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProfiles, setSearchProfiles] = useState<Profile[]>([]);
  const [searchPosts, setSearchPosts] = useState<Post[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<GroupMember[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupPrivate, setNewGroupPrivate] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [viewingProfilePosts, setViewingProfilePosts] = useState<Post[]>([]);
  const [profileContent, setProfileContent] = useState<Post[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ handle: '', displayName: '', bio: '', avatarUrl: '', websiteUrl: '', isPrivate: false });
  const [newPostUrl, setNewPostUrl] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostType, setNewPostType] = useState<'image' | 'video'>('image');
  const [newProductTitle, setNewProductTitle] = useState('');
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newStoryUrl, setNewStoryUrl] = useState('');
  const [newStoryType, setNewStoryType] = useState<'image' | 'video'>('image');
  const [newThreadRecipient, setNewThreadRecipient] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<'pending' | 'ready' | 'permission-denied' | 'needs-configuration' | 'unavailable'>('pending');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [adsWatched, setAdsWatched] = useState(0);
  const [adsRequired, setAdsRequired] = useState(5);
  const [showRoulette, setShowRoulette] = useState(false);
  const [rouletteSession, setRouletteSession] = useState<RouletteSession | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<any | null>(null);
  const rotation = useRef(new Animated.Value(0)).current;
  const viewedFeedPosts = useRef(new Set<string>()).current;
  const selectedGroupMembership = useMemo(
    () => selectedGroupMembers.find((member) => member.accountId === currentUser?.id),
    [selectedGroupMembers, currentUser?.id],
  );
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
  });

  const headers = useMemo(() => {
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      base.Authorization = `Bearer ${token}`;
    }
    return base;
  }, [token]);

  useEffect(() => {
    SecureStore.getItemAsync(SESSION_STORAGE_KEY)
      .then((savedToken) => { if (savedToken) setToken(savedToken); })
      .catch((error) => console.warn('session restore', error));
  }, []);

  useEffect(() => {
    if (token) {
      loadCurrentProfile();
      loadFeed();
      loadStories();
      loadAdsProgress();
    }
  }, [token]);

  useEffect(() => {
    if (token && activeTab === 'feed') {
      loadFeed();
      loadStories();
    }
    if (token && activeTab === 'dms') {
      loadThreads();
    }
    if (token && activeTab === 'groups') {
      loadGroups();
    }
  }, [activeTab, token]);

  useEffect(() => {
    if (!token || !['android', 'ios'].includes(Platform.OS)) {
      setPushStatus(token ? 'unavailable' : 'pending');
      return;
    }

    let cancelled = false;
    async function registerForPushNotifications() {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('messages', {
            name: 'Messages',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#ffcc2c',
          });
        }

        const existingPermissions = await Notifications.getPermissionsAsync();
        const finalPermissions = existingPermissions.status === 'granted'
          ? existingPermissions
          : await Notifications.requestPermissionsAsync();
        if (finalPermissions.status !== 'granted') {
          if (!cancelled) setPushStatus('permission-denied');
          return;
        }

        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID
          || Constants.expoConfig?.extra?.eas?.projectId
          || Constants.easConfig?.projectId;
        if (!projectId) {
          if (!cancelled) setPushStatus('needs-configuration');
          return;
        }

        const deviceToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        await fetchJson('/notifications/push-tokens', {
          method: 'POST',
          headers,
          body: JSON.stringify({ token: deviceToken, platform: Platform.OS }),
        });
        if (!cancelled) {
          setExpoPushToken(deviceToken);
          setPushStatus('ready');
        }
      } catch (error) {
        console.warn('push registration', error);
        if (!cancelled) setPushStatus('unavailable');
      }
    }

    registerForPushNotifications();
    return () => {
      cancelled = true;
    };
  }, [token, headers]);

  useEffect(() => {
    if (!token || Platform.OS === 'web') return;

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'direct_message' && typeof data.threadId === 'string') {
        setActiveTab('dms');
        loadThread(data.threadId);
      }
    });

    return () => responseSubscription.remove();
  }, [token, headers]);

  useEffect(() => {
    if (!token) {
      setRealtimeConnected(false);
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let reconnectAttempt = 0;

    function connect() {
      if (stopped) return;
      socket = new WebSocket(REALTIME_URL);
      socket.onopen = () => {
        socket?.send(JSON.stringify({ type: 'authenticate', token }));
      };
      socket.onmessage = (messageEvent) => {
        try {
          const event = JSON.parse(messageEvent.data);
          if (event.type === 'connected') {
            reconnectAttempt = 0;
            setRealtimeConnected(true);
            return;
          }
          if (event.type === 'direct_message' && event.message) {
            setSelectedThread((current: any) => {
              if (!current || current.id !== event.threadId) return current;
              const messages = current.messages || [];
              if (messages.some((message: any) => message.id === event.message.id)) return current;
              return { ...current, messages: [...messages, event.message], updatedAt: event.message.created_at };
            });
            loadThreads();
          }
        } catch (error) {
          console.warn('realtime event', error);
        }
      };
      socket.onerror = () => setRealtimeConnected(false);
      socket.onclose = () => {
        setRealtimeConnected(false);
        if (!stopped) {
          const delay = Math.min(1000 * (2 ** reconnectAttempt), 30000);
          reconnectAttempt += 1;
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token]);

  async function fetchJson(path: string, options: RequestInit = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, options);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || data.error || 'Request failed');
    }
    return data;
  }

  async function submitAuth() {
    const endpoint = mode === 'signup' ? '/auth/register' : '/auth/login';
    const body = mode === 'signup'
      ? { email, password, displayName }
      : { email, password };

    try {
      setLoading(true);
      const data = await fetchJson(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setToken(data.token);
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, data.token);
      setCurrentUser({ id: data.user.id, handle: '', displayName: data.user.displayName, bio: '', avatarUrl: '', isPrivate: false });
      setActiveTab('feed');
      setStatusMessage('Signed in successfully');
    } catch (error) {
      Alert.alert('Auth error', error instanceof Error ? error.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  async function finishGoogleAuth(idToken: string) {
    try {
      setLoading(true);
      const data = await fetchJson('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      setToken(data.token);
      await SecureStore.setItemAsync(SESSION_STORAGE_KEY, data.token);
      setCurrentUser({ id: data.user.id, handle: '', displayName: data.user.displayName, bio: '', avatarUrl: '', isPrivate: false });
      setActiveTab('feed');
      setStatusMessage('Signed in with Google');
    } catch (error) {
      Alert.alert('Google error', error instanceof Error ? error.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const idToken = googleResponse?.type === 'success'
      ? googleResponse.authentication?.idToken || googleResponse.params?.id_token
      : null;
    if (idToken) finishGoogleAuth(idToken);
  }, [googleResponse]);

  async function continueWithGoogle() {
    if (!googleRequest) {
      Alert.alert('Google unavailable', 'Google sign-in is not ready yet.');
      return;
    }
    await promptGoogleAsync();
  }

  async function logout() {
    if (token && expoPushToken) {
      try {
        await fetchJson('/notifications/push-tokens', {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ token: expoPushToken, platform: Platform.OS }),
        });
      } catch (error) {
        console.warn('push unregister', error);
      }
    }
    try {
      if (token) await fetchJson('/auth/logout', { method: 'POST', headers });
    } catch (error) {
      console.warn('logout', error);
    } finally {
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      setToken(null);
      setCurrentUser(null);
      setViewingProfile(null);
      setStatusMessage(null);
      setExpoPushToken(null);
      setPushStatus('pending');
      setRealtimeConnected(false);
    }
  }

  async function loadCurrentProfile() {
    try {
      const data = await fetchJson('/profiles/me', { headers });
      setCurrentUser(data.profile);
      setProfileEdit({
        handle: data.profile.handle ?? '',
        displayName: data.profile.displayName ?? '',
        bio: data.profile.bio ?? '',
        avatarUrl: data.profile.avatarUrl ?? '',
        websiteUrl: data.profile.websiteUrl ?? '',
        isPrivate: Boolean(data.profile.isPrivate),
      });
      await loadMyContent();
      loadAdsProgress();
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadAdsProgress() {
    if (!token) return;
    try {
      const data = await fetchJson('/roulette/ads/progress', { headers });
      setAdsWatched(data.watched || 0);
      setAdsRequired(data.required || 5);
    } catch (error) {
      console.warn('ads progress', error);
    }
  }

  async function watchAd() {
    if (!token) {
      Alert.alert('Not signed in');
      return;
    }
    try {
      const data = await fetchJson('/roulette/ads/watched', { method: 'POST', headers });
      setAdsWatched(data.watched || 0);
      setAdsRequired(data.required || 5);
      setStatusMessage('Ad recorded');
    } catch (error) {
      Alert.alert('Ad failed', error instanceof Error ? error.message : 'Unable to record ad');
    }
  }

  async function openRoulette() {
    if (!token) {
      Alert.alert('Not signed in');
      return;
    }
    try {
      const data = await fetchJson('/roulette/session', { headers });
      setRouletteSession(data);
      setShowRoulette(true);
      setSpinResult(null);
    } catch (error) {
      Alert.alert('Roulette error', error instanceof Error ? error.message : 'Unable to start session');
    }
  }

  function animateSpin(targetDegrees = 1440, duration = 3000) {
    rotation.setValue(0);
    return Animated.timing(rotation, {
      toValue: targetDegrees / 360,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
  }

  async function spinRoulette() {
    if (!rouletteSession) return;
    setSpinning(true);
    try {
      const data = await fetchJson('/roulette/spin', { method: 'POST', headers, body: JSON.stringify({ sessionId: rouletteSession.sessionId }) });
      const visualIndex = Number(data.prize?.visualIndex ?? 0);
      const targetDegrees = 1440 + (360 - (visualIndex * 90 + 45));
      const anim = animateSpin(targetDegrees);
      anim.start();
      // wait for animation to finish
      setTimeout(() => {
        anim.stop();
        setSpinning(false);
        setSpinResult(data.prize);
        // refresh ads progress
        loadAdsProgress();
      }, 3000);
    } catch (error) {
      setSpinning(false);
      Alert.alert('Spin failed', error instanceof Error ? error.message : 'Unable to spin');
    }
  }

  async function loadFeed() {
    setFeedLoading(true);
    setFeedError(null);
    try {
      const data = await fetchJson('/feed', { headers });
      setFeed(data.feed || []);
      const summaries = await Promise.all((data.feed || []).map(async (post: Post) => {
        try {
          const engagement = await fetchJson(`/content/${post.id}/engagement`, { headers });
          return [post.id, engagement.engagement] as const;
        } catch (error) {
          console.warn('engagement', error);
          return null;
        }
      }));
      setEngagementByPost((current) => ({
        ...current,
        ...Object.fromEntries(summaries.filter((item): item is readonly [string, Engagement] => item !== null)),
      }));
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : 'Unable to load feed');
      console.warn(error);
    } finally {
      setFeedLoading(false);
    }
  }

  async function recordFeedView(postId: string, completed = false) {
    if (!token || viewedFeedPosts.has(postId)) return;
    viewedFeedPosts.add(postId);
    try {
      await fetchJson(`/feed/${postId}/view`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ completed }),
      });
    } catch (error) {
      viewedFeedPosts.delete(postId);
      console.warn('feed view', error);
    }
  }

  async function openAffiliateOffer(offer: AffiliateOffer) {
    try {
      const data = await fetchJson(`/affiliate-links/${offer.id}/open`, {
        method: 'POST',
        headers,
      });
      const opened = data.open;
      if (opened.testMode) {
        Alert.alert('Amazon link preview', opened.notice);
      }
      await WebBrowser.openBrowserAsync(opened.destinationUrl, {
        toolbarColor: '#0b1f14',
        controlsColor: '#ffcc2c',
        dismissButtonStyle: 'close',
        enableBarCollapsing: true,
        showTitle: true,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch (error) {
      Alert.alert('Product link unavailable', error instanceof Error ? error.message : 'Unable to open this Amazon product.');
    }
  }

  async function toggleLike(postId: string) {
    const current = engagementByPost[postId];
    try {
      const data = await fetchJson(`/content/${postId}/like`, {
        method: current?.likedByViewer ? 'DELETE' : 'POST',
        headers,
      });
      setEngagementByPost((items) => ({ ...items, [postId]: data.engagement }));
    } catch (error) {
      Alert.alert('Like failed', error instanceof Error ? error.message : 'Unable to update like');
    }
  }

  async function toggleBookmark(postId: string) {
    const current = engagementByPost[postId];
    try {
      const method = current?.bookmarkedByViewer ? 'DELETE' : 'POST';
      const data = await fetchJson(`/content/${postId}/bookmark`, { method, headers });
      setEngagementByPost((items) => ({ ...items, [postId]: data.engagement }));
    } catch (error) {
      Alert.alert('Save failed', error instanceof Error ? error.message : 'Unable to update save');
    }
  }

  async function loadComments(postId: string) {
    try {
      const data = await fetchJson(`/content/${postId}/comments`, { headers });
      setCommentsByPost((items) => ({ ...items, [postId]: data.comments || [] }));
      setExpandedComments((items) => ({ ...items, [postId]: true }));
    } catch (error) {
      Alert.alert('Comments failed', error instanceof Error ? error.message : 'Unable to load comments');
    }
  }

  async function addComment(postId: string) {
    const body = commentDrafts[postId]?.trim();
    if (!body) return;
    try {
      await fetchJson(`/content/${postId}/comments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ body }),
      });
      setCommentDrafts((items) => ({ ...items, [postId]: '' }));
      await loadComments(postId);
      const summary = await fetchJson(`/content/${postId}/engagement`, { headers });
      setEngagementByPost((items) => ({ ...items, [postId]: summary.engagement }));
    } catch (error) {
      Alert.alert('Comment failed', error instanceof Error ? error.message : 'Unable to add comment');
    }
  }

  async function loadStories() {
    try {
      const data = await fetchJson('/stories', { headers });
      setStories(data.stories || []);
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadThreads() {
    try {
      const data = await fetchJson('/dms', { headers });
      setThreads(data.threads || []);
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadThread(threadId: string) {
    try {
      const data = await fetchJson(`/dms/${threadId}`, { headers });
      setSelectedThread(data.thread);
    } catch (error) {
      Alert.alert('Thread error', error instanceof Error ? error.message : 'Unable to load thread');
    }
  }

  async function loadGroups() {
    setGroupsLoading(true);
    try {
      const data = await fetchJson('/groups', { headers });
      setGroups(data.groups || []);
    } catch (error) {
      Alert.alert('Community error', error instanceof Error ? error.message : 'Unable to load communities');
    } finally {
      setGroupsLoading(false);
    }
  }

  async function loadGroup(groupId: string) {
    try {
      const data = await fetchJson(`/groups/${groupId}`, { headers });
      setSelectedGroup(data.group);
      setSelectedGroupMembers(data.members || []);
    } catch (error) {
      Alert.alert('Community error', error instanceof Error ? error.message : 'Unable to load this community');
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) {
      Alert.alert('Community name required', 'Give the community a name before creating it.');
      return;
    }
    try {
      const data = await fetchJson('/groups', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDescription.trim() || null,
          isPrivate: newGroupPrivate,
        }),
      });
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupPrivate(false);
      setStatusMessage('Community created');
      await loadGroups();
      await loadGroup(data.group.id);
    } catch (error) {
      Alert.alert('Create failed', error instanceof Error ? error.message : 'Unable to create the community');
    }
  }

  async function joinGroup(groupId: string) {
    try {
      const data = await fetchJson(`/groups/${groupId}/join`, { method: 'POST', headers });
      setStatusMessage(data.status === 'pending' ? 'Join request sent' : 'Joined community');
      await loadGroup(groupId);
    } catch (error) {
      Alert.alert('Join failed', error instanceof Error ? error.message : 'Unable to join the community');
    }
  }

  async function leaveGroup(groupId: string) {
    try {
      await fetchJson(`/groups/${groupId}/membership`, { method: 'DELETE', headers });
      setStatusMessage('Left community');
      await loadGroup(groupId);
    } catch (error) {
      Alert.alert('Leave failed', error instanceof Error ? error.message : 'Unable to leave the community');
    }
  }

  async function approveGroupMember(groupId: string, accountId: string) {
    try {
      await fetchJson(`/groups/${groupId}/members/${encodeURIComponent(accountId)}/approve`, { method: 'POST', headers });
      setStatusMessage('Member approved');
      await loadGroup(groupId);
    } catch (error) {
      Alert.alert('Approval failed', error instanceof Error ? error.message : 'Unable to approve this member');
    }
  }

  async function loadMyContent() {
    try {
      const data = await fetchJson('/content/mine', { headers });
      setProfileContent(data.content || []);
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadProfile(handle: string) {
    try {
      const data = await fetchJson(`/profiles/handle/${handle}`, { headers });
      setViewingProfile(data.profile);
      setViewingProfilePosts(data.content || []);
      setActiveTab('profile');
      setEditMode(false);
    } catch (error) {
      Alert.alert('Profile load error', error instanceof Error ? error.message : 'Unable to load profile');
    }
  }

  async function followProfile(profileId: string) {
    try {
      const data = await fetchJson('/follows', {
        method: 'POST',
        headers,
        body: JSON.stringify({ followeeProfileId: profileId }),
      });
      setViewingProfile((profile) => profile ? { ...profile, relationshipStatus: data.status === 'approved' ? 'following' : 'requested' } : profile);
    } catch (error) {
      Alert.alert('Follow failed', error instanceof Error ? error.message : 'Unable to follow profile');
    }
  }

  async function search() {
    if (!searchQuery.trim()) {
      setSearchProfiles([]);
      setSearchPosts([]);
      return;
    }
    try {
      const data = await fetchJson(`/search?query=${encodeURIComponent(searchQuery.trim())}`, { headers });
      setSearchProfiles(data.profiles || []);
      setSearchPosts(data.posts || []);
    } catch (error) {
      console.warn(error);
    }
  }

  async function updateProfile() {
    try {
      const payload = {
        handle: profileEdit.handle,
        displayName: profileEdit.displayName,
        bio: profileEdit.bio,
        avatarUrl: profileEdit.avatarUrl,
        websiteUrl: profileEdit.websiteUrl,
        isPrivate: profileEdit.isPrivate,
      };
      const data = await fetchJson('/profiles/me', { method: 'POST', headers, body: JSON.stringify(payload) });
      setCurrentUser(data.profile);
      setStatusMessage('Profile updated');
      setEditMode(false);
    } catch (error) {
      Alert.alert('Update failed', error instanceof Error ? error.message : 'Unable to update profile');
    }
  }

  async function createPost() {
    if (!newPostUrl.trim()) {
      Alert.alert('Post error', 'Enter a media URL before posting.');
      return;
    }

    if ((newProductUrl.trim() && !newProductTitle.trim()) || (!newProductUrl.trim() && newProductTitle.trim())) {
      Alert.alert('Product error', 'Add both the Amazon product title and its direct product link, or leave both empty.');
      return;
    }

    let createdPost: Post;
    try {
      const payload: any = { caption: newPostCaption || '' };
      if (newPostType === 'video') {
        payload.videoUrl = newPostUrl.trim();
      } else {
        payload.mediaItems = [{ id: 'new-media', mediaType: 'image', url: newPostUrl.trim(), orderIndex: 0 }];
      }
      const data = await fetchJson('/content', { method: 'POST', headers, body: JSON.stringify(payload) });
      createdPost = data.content;
    } catch (error) {
      Alert.alert('Post failed', error instanceof Error ? error.message : 'Unable to create post');
      return;
    }

    let productAttached = false;
    if (newProductUrl.trim()) {
      try {
        await fetchJson(`/content/${createdPost.id}/affiliate-links`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            provider: 'amazon',
            title: newProductTitle.trim(),
            productUrl: newProductUrl.trim(),
          }),
        });
        productAttached = true;
      } catch (error) {
        Alert.alert(
          'Post created without product',
          error instanceof Error ? error.message : 'The post is live, but the Amazon product could not be attached.',
        );
      }
    }

    setNewPostUrl('');
    setNewPostCaption('');
    setNewProductTitle('');
    setNewProductUrl('');
    setStatusMessage(productAttached ? 'Post and Amazon product created' : 'Post created');
    await loadFeed();
    await loadMyContent();
  }

  async function createStory() {
    if (!newStoryUrl.trim()) {
      Alert.alert('Story error', 'Enter a story URL before posting.');
      return;
    }

    try {
      await fetchJson('/stories', {
        method: 'POST',
        headers,
        body: JSON.stringify({ mediaType: newStoryType, mediaUrl: newStoryUrl.trim() }),
      });
      setNewStoryUrl('');
      setStatusMessage('Story created');
      await loadStories();
    } catch (error) {
      Alert.alert('Story failed', error instanceof Error ? error.message : 'Unable to create story');
    }
  }

  async function recordStoryView(storyId: string) {
    try {
      await fetchJson(`/stories/${storyId}/view`, { method: 'POST', headers });
    } catch (error) {
      console.warn(error);
    }
  }

  async function createThread() {
    if (!newThreadRecipient.trim() || !newThreadMessage.trim()) {
      Alert.alert('DM error', 'Enter a recipient and a message.');
      return;
    }
    try {
      const data = await fetchJson('/dms', {
        method: 'POST',
        headers,
        body: JSON.stringify({ recipientId: newThreadRecipient.trim(), initialMessage: newThreadMessage.trim() }),
      });
      setNewThreadRecipient('');
      setNewThreadMessage('');
      setStatusMessage('Thread created');
      await loadThreads();
      if (data.thread?.id) {
        loadThread(data.thread.id);
      }
    } catch (error) {
      Alert.alert('DM failed', error instanceof Error ? error.message : 'Unable to create thread');
    }
  }

  async function sendMessage() {
    if (!selectedThread || !newMessageText.trim()) {
      return;
    }
    try {
      await fetchJson(`/dms/${selectedThread.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: newMessageText.trim() }),
      });
      setNewMessageText('');
      loadThread(selectedThread.id);
      loadThreads();
    } catch (error) {
      Alert.alert('Send failed', error instanceof Error ? error.message : 'Unable to deliver message');
    }
  }

  function renderTabButton(tab: Tab, label: string) {
    return (
      <Pressable
        style={[styles.tab, activeTab === tab && styles.tabActive]}
        onPress={() => { setActiveTab(tab); setStatusMessage(null); if (tab === 'profile') { if (!viewingProfile) loadCurrentProfile(); } }}
      >
        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{label}</Text>
      </Pressable>
    );
  }

  if (!token) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>PartnerHub</Text>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                This is the first step in a more complete onboarding flow for the feed, profile, stories, and messaging.
              </Text>
            </View>

            <View style={styles.tabs}>
              <Pressable style={[styles.tab, mode === 'signup' && styles.tabActive]} onPress={() => setMode('signup')}>
                <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign up</Text>
              </Pressable>
              <Pressable style={[styles.tab, mode === 'login' && styles.tabActive]} onPress={() => setMode('login')}>
                <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Log in</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              {mode === 'signup' ? (
                <TextInput
                  style={styles.input}
                  placeholder="Display name"
                  placeholderTextColor="#94a3b8"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              ) : null}
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#94a3b8"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <Pressable style={styles.primaryButton} onPress={submitAuth} disabled={loading}>
                {loading ? <ActivityIndicator color="#111827" /> : <Text style={styles.primaryButtonText}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text>}
              </Pressable>

              <Pressable style={styles.secondaryButton} onPress={continueWithGoogle} disabled={loading}>
                {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.secondaryButtonText}>Continue with Google</Text>}
              </Pressable>
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Onboarding-ready</Text>
              <Text style={styles.noteText}>The screen is structured so you can slot in phone-number verification, consent, and profile setup before the first feed appears.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>PartnerHub</Text>
            <Text style={styles.headerSubtitle}>Feed, communities, messages, profile</Text>
          </View>
          <Pressable style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutButtonText}>Log out</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tabRow}>
        {renderTabButton('feed', 'Feed')}
        {renderTabButton('search', 'Search')}
        {renderTabButton('groups', 'Groups')}
        {renderTabButton('dms', 'DMs')}
        {renderTabButton('profile', 'Profile')}
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{statusMessage || `Signed in as ${currentUser?.displayName ?? 'you'}`}</Text>
        <Text style={styles.connectionStatus}>
          {realtimeConnected ? 'Live messages connected' : 'Live messages reconnecting'} · Push {pushStatus.replace('-', ' ')}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.mainContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'feed' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storyRow}>
                {stories.map((story) => (
                  <Pressable key={story.id} style={styles.storyBubble} onPress={() => { setSelectedStory(story); recordStoryView(story.id); }}>
                    <View style={styles.storyCircle}>
                      <Text style={styles.storyCircleText}>{story.mediaType === 'video' ? '🎥' : '📷'}</Text>
                    </View>
                    <Text style={styles.storyText}>{story.creatorId}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Create a post</Text>
              <View style={styles.card}>
                <View style={styles.row}> 
                  <Pressable style={[styles.smallTab, newPostType === 'image' && styles.smallTabActive]} onPress={() => setNewPostType('image')}>
                    <Text style={[styles.smallTabText, newPostType === 'image' && styles.smallTabTextActive]}>Image</Text>
                  </Pressable>
                  <Pressable style={[styles.smallTab, newPostType === 'video' && styles.smallTabActive]} onPress={() => setNewPostType('video')}>
                    <Text style={[styles.smallTabText, newPostType === 'video' && styles.smallTabTextActive]}>Video</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Media URL"
                  placeholderTextColor="#94a3b8"
                  value={newPostUrl}
                  onChangeText={setNewPostUrl}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Caption"
                  placeholderTextColor="#94a3b8"
                  value={newPostCaption}
                  onChangeText={setNewPostCaption}
                />
                <Text style={styles.optionalFieldLabel}>Optional physical product</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Product title"
                  placeholderTextColor="#94a3b8"
                  value={newProductTitle}
                  onChangeText={setNewProductTitle}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Direct Amazon product URL"
                  placeholderTextColor="#94a3b8"
                  value={newProductUrl}
                  onChangeText={setNewProductUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
                <Text style={styles.productHelperText}>Golt removes personal tracking tags. Amazon controls the final price, checkout, delivery, and returns.</Text>
                <Pressable style={styles.primaryButton} onPress={createPost}>
                  <Text style={styles.primaryButtonText}>Post</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Create a story</Text>
              <View style={styles.card}>
                <View style={styles.row}>
                  <Pressable style={[styles.smallTab, newStoryType === 'image' && styles.smallTabActive]} onPress={() => setNewStoryType('image')}>
                    <Text style={[styles.smallTabText, newStoryType === 'image' && styles.smallTabTextActive]}>Image</Text>
                  </Pressable>
                  <Pressable style={[styles.smallTab, newStoryType === 'video' && styles.smallTabActive]} onPress={() => setNewStoryType('video')}>
                    <Text style={[styles.smallTabText, newStoryType === 'video' && styles.smallTabTextActive]}>Video</Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Story URL"
                  placeholderTextColor="#94a3b8"
                  value={newStoryUrl}
                  onChangeText={setNewStoryUrl}
                />
                <Pressable style={styles.primaryButton} onPress={createStory}>
                  <Text style={styles.primaryButtonText}>Share story</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Feed</Text>
              {feedLoading ? <ActivityIndicator color="#ffcc2c" /> : null}
              {feedError ? (
                <View style={styles.feedState}>
                  <Text style={styles.feedStateText}>{feedError}</Text>
                  <Pressable style={styles.secondaryButton} onPress={loadFeed}>
                    <Text style={styles.secondaryButtonText}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
              {!feedLoading && !feedError && feed.length === 0 ? (
                <View style={styles.feedState}>
                  <Text style={styles.feedStateText}>Your feed is empty.</Text>
                  <Text style={styles.feedStateHint}>Follow creators or publish a post to get started.</Text>
                </View>
              ) : null}
              {feed.map((post) => (
                <Pressable key={post.id} style={styles.postCard} onPress={() => recordFeedView(post.id)}>
                  <View style={styles.postHeader}>
                    {post.creatorAvatarUrl ? <Image source={{ uri: post.creatorAvatarUrl }} style={styles.avatarImage} /> : <View style={styles.avatarCircle}><Text style={styles.avatarText}>{post.creatorDisplayName?.charAt(0) || 'U'}</Text></View>}
                    <View style={styles.postAuthorBlock}>
                      <Text style={styles.postAuthor}>{post.creatorDisplayName || post.creatorId}</Text>
                      <Text style={styles.postHandle}>@{post.creatorHandle || post.creatorId}</Text>
                    </View>
                  </View>
                  {post.mediaItems?.[0]?.url && post.mediaItems[0].mediaType !== 'video' ? (
                    <View style={styles.postMediaFrame}>
                      <Image source={{ uri: post.mediaItems[0].url }} style={styles.postMediaImage} resizeMode="cover" />
                    </View>
                  ) : null}
                  {post.videoUrl || (post.mediaItems?.[0]?.mediaType === 'video' ? post.mediaItems[0].url : null) ? (
                    <View style={styles.postMediaFrame}>
                      <NativeVideoPlayer
                        uri={post.videoUrl || post.mediaItems?.[0]?.url || ''}
                        onPlay={() => recordFeedView(post.id)}
                      />
                    </View>
                  ) : null}
                  {post.caption ? <Text style={styles.postCaption}>{post.caption}</Text> : null}
                  {post.affiliateOffers?.map((offer) => (
                    <View key={offer.id} style={styles.productCard}>
                      <Text style={styles.productEyebrow}>Physical product · Sold on {offer.merchantName}</Text>
                      <Text style={styles.productTitle}>{offer.title}</Text>
                      <Text style={styles.productNotice}>{offer.priceNotice}</Text>
                      <Text style={styles.affiliateDisclosure}>{offer.disclosure}</Text>
                      <Pressable
                        style={styles.productButton}
                        onPress={(event) => {
                          event.stopPropagation();
                          openAffiliateOffer(offer);
                        }}
                      >
                        <Text style={styles.productButtonText}>View on Amazon</Text>
                      </Pressable>
                      {!offer.commissionTrackingActive ? <Text style={styles.previewLabel}>Preview mode · commission tracking is off</Text> : null}
                    </View>
                  ))}
                  <View style={styles.postFooter}>
                    <Text style={styles.postStats}>{post.views || 0} views</Text>
                    <Text style={styles.postStats}>{post.completions || 0} completions</Text>
                  </View>
                  <View style={styles.engagementRow}>
                    <Pressable style={styles.engagementButton} onPress={() => toggleLike(post.id)}>
                      <Text style={styles.engagementButtonText}>{engagementByPost[post.id]?.likedByViewer ? 'Liked' : 'Like'} {engagementByPost[post.id]?.likes || 0}</Text>
                    </Pressable>
                    <Pressable style={styles.engagementButton} onPress={() => loadComments(post.id)}>
                      <Text style={styles.engagementButtonText}>Comments {engagementByPost[post.id]?.comments || 0}</Text>
                    </Pressable>
                    <Pressable style={styles.engagementButton} onPress={() => toggleBookmark(post.id)}>
                      <Text style={styles.engagementButtonText}>{engagementByPost[post.id]?.bookmarkedByViewer ? 'Saved' : 'Save'}</Text>
                    </Pressable>
                  </View>
                  {expandedComments[post.id] ? (
                    <View style={styles.commentsPanel}>
                      {(commentsByPost[post.id] || []).map((comment) => <Text key={comment.id} style={styles.commentText}>@{comment.accountId}: {comment.body}</Text>)}
                      <TextInput
                        style={styles.commentInput}
                        placeholder="Add a comment"
                        placeholderTextColor="#94a3b8"
                        value={commentDrafts[post.id] || ''}
                        onChangeText={(value) => setCommentDrafts((items) => ({ ...items, [post.id]: value }))}
                        onSubmitEditing={() => addComment(post.id)}
                      />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </View>
          </>
        ) : activeTab === 'search' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Search</Text>
            <TextInput
              style={styles.input}
              placeholder="Search profiles or posts"
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={search}
            />
            <Pressable style={styles.primaryButton} onPress={search}>
              <Text style={styles.primaryButtonText}>Search</Text>
            </Pressable>
            <View style={styles.sectionList}>
              <Text style={styles.sectionSubtitle}>Profiles</Text>
              {searchProfiles.map((profileItem) => (
                <View key={profileItem.id} style={styles.searchItem}>
                  <Text style={styles.searchItemTitle}>{profileItem.displayName}</Text>
                  <Text style={styles.searchItemSubtitle}>{profileItem.handle}</Text>
                  <Pressable style={styles.linkButton} onPress={() => loadProfile(profileItem.handle)}>
                    <Text style={styles.linkButtonText}>View profile</Text>
                  </Pressable>
                </View>
              ))}
            </View>
            <View style={styles.sectionList}>
              <Text style={styles.sectionSubtitle}>Posts</Text>
              {searchPosts.map((post) => (
                <View key={post.id} style={styles.searchItem}>
                  <Text style={styles.searchItemTitle}>{post.caption || 'Untitled post'}</Text>
                  <Text style={styles.searchItemSubtitle}>{post.creatorHandle || post.creatorId}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : activeTab === 'groups' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Communities</Text>
            <View style={styles.card}>
              <Text style={styles.sectionSubtitle}>Create a community</Text>
              <TextInput
                style={styles.input}
                placeholder="Community name"
                placeholderTextColor="#94a3b8"
                value={newGroupName}
                onChangeText={setNewGroupName}
              />
              <TextInput
                style={[styles.input, styles.multilineInput]}
                placeholder="What is this community about?"
                placeholderTextColor="#94a3b8"
                value={newGroupDescription}
                onChangeText={setNewGroupDescription}
                multiline
              />
              <View style={styles.row}>
                <Pressable
                  style={[styles.smallTab, !newGroupPrivate && styles.smallTabActive]}
                  onPress={() => setNewGroupPrivate(false)}
                >
                  <Text style={[styles.smallTabText, !newGroupPrivate && styles.smallTabTextActive]}>Open</Text>
                </Pressable>
                <Pressable
                  style={[styles.smallTab, newGroupPrivate && styles.smallTabActive]}
                  onPress={() => setNewGroupPrivate(true)}
                >
                  <Text style={[styles.smallTabText, newGroupPrivate && styles.smallTabTextActive]}>Approval required</Text>
                </Pressable>
              </View>
              <Pressable style={styles.primaryButton} onPress={createGroup}>
                <Text style={styles.primaryButtonText}>Create community</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionSubtitle}>Discover</Text>
            {groupsLoading ? <ActivityIndicator color="#ffcc2c" /> : null}
            {!groupsLoading && groups.length === 0 ? (
              <View style={styles.feedState}>
                <Text style={styles.feedStateText}>No communities exist yet.</Text>
                <Text style={styles.feedStateHint}>Create the first one above.</Text>
              </View>
            ) : null}
            {groups.map((group) => (
              <Pressable key={group.id} style={styles.groupCard} onPress={() => loadGroup(group.id)}>
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.privacyPill}>{group.isPrivate ? 'Approval' : 'Open'}</Text>
                </View>
                <Text style={styles.groupDescription}>{group.description || 'No description yet.'}</Text>
                <Text style={styles.groupOwner}>Created by {group.ownerId}</Text>
              </Pressable>
            ))}

            {selectedGroup ? (
              <View style={styles.card}>
                <View style={styles.groupHeaderRow}>
                  <Text style={styles.sectionTitle}>{selectedGroup.name}</Text>
                  <Pressable onPress={() => { setSelectedGroup(null); setSelectedGroupMembers([]); }}>
                    <Text style={styles.closeText}>Close</Text>
                  </Pressable>
                </View>
                <Text style={styles.groupDescription}>{selectedGroup.description || 'No description yet.'}</Text>
                <Text style={styles.groupOwner}>
                  {selectedGroup.isPrivate ? 'Owner approval is required to join.' : 'Anyone can join immediately.'}
                </Text>
                <Text style={styles.sectionSubtitle}>Members ({selectedGroupMembers.filter((member) => member.role !== 'pending').length})</Text>
                {selectedGroupMembers.filter((member) => member.role !== 'pending').map((member) => (
                  <View key={member.accountId} style={styles.memberRow}>
                    <Text style={styles.memberName}>{member.accountId}</Text>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                ))}

                {selectedGroup.ownerId === currentUser?.id ? (
                  <View style={styles.pendingMembers}>
                    <Text style={styles.sectionSubtitle}>Waiting for approval</Text>
                    {selectedGroupMembers.filter((member) => member.role === 'pending').length === 0 ? (
                      <Text style={styles.groupDescription}>No requests are waiting.</Text>
                    ) : null}
                    {selectedGroupMembers.filter((member) => member.role === 'pending').map((member) => (
                      <View key={member.accountId} style={styles.memberRow}>
                        <Text style={styles.memberName}>{member.accountId}</Text>
                        <Pressable
                          style={styles.smallAction}
                          onPress={() => approveGroupMember(selectedGroup.id, member.accountId)}
                        >
                          <Text style={styles.smallActionText}>Approve</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}

                {!selectedGroupMembership ? (
                  <Pressable style={styles.primaryButton} onPress={() => joinGroup(selectedGroup.id)}>
                    <Text style={styles.primaryButtonText}>{selectedGroup.isPrivate ? 'Request to join' : 'Join community'}</Text>
                  </Pressable>
                ) : selectedGroupMembership.role === 'pending' ? (
                  <View style={styles.pendingNotice}>
                    <Text style={styles.pendingNoticeText}>Your request is waiting for the owner.</Text>
                  </View>
                ) : selectedGroupMembership.role !== 'owner' ? (
                  <Pressable style={styles.secondaryButton} onPress={() => leaveGroup(selectedGroup.id)}>
                    <Text style={styles.secondaryButtonText}>Leave community</Text>
                  </Pressable>
                ) : (
                  <View style={styles.pendingNotice}>
                    <Text style={styles.pendingNoticeText}>You own this community.</Text>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        ) : activeTab === 'dms' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Direct messages</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.input}
                placeholder="Recipient user ID"
                placeholderTextColor="#94a3b8"
                value={newThreadRecipient}
                onChangeText={setNewThreadRecipient}
              />
              <TextInput
                style={styles.input}
                placeholder="Message"
                placeholderTextColor="#94a3b8"
                value={newThreadMessage}
                onChangeText={setNewThreadMessage}
              />
              <Pressable style={styles.primaryButton} onPress={createThread}>
                <Text style={styles.primaryButtonText}>Start thread</Text>
              </Pressable>
            </View>
            <View style={styles.sectionList}>
              {threads.map((thread) => (
                <Pressable key={thread.id} style={styles.threadCard} onPress={() => loadThread(thread.id)}>
                  <Text style={styles.threadTitle}>{thread.participantIds.join(', ')}</Text>
                  <Text style={styles.threadSubtitle}>{thread.lastMessage}</Text>
                </Pressable>
              ))}
            </View>
            {selectedThread ? (
              <View style={styles.card}>
                <Text style={styles.sectionSubtitle}>Thread</Text>
                {selectedThread.messages?.map((message: any) => (
                  <View key={message.id} style={styles.messageRow}>
                    <Text style={styles.messageSender}>{message.senderId}</Text>
                    <Text style={styles.messageText}>{message.content}</Text>
                  </View>
                ))}
                <TextInput
                  style={styles.input}
                  placeholder="Type a message"
                  placeholderTextColor="#94a3b8"
                  value={newMessageText}
                  onChangeText={setNewMessageText}
                />
                <Pressable style={styles.primaryButton} onPress={sendMessage}>
                  <Text style={styles.primaryButtonText}>Send</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{viewingProfile ? 'Profile' : 'My profile'}</Text>
            {(viewingProfile || currentUser) ? (
              <View style={styles.card}>
                {(viewingProfile || currentUser)?.bannerUrl ? <Image source={{ uri: (viewingProfile || currentUser)?.bannerUrl || undefined }} style={styles.profileBanner} /> : null}
                {(viewingProfile || currentUser)?.avatarUrl ? <Image source={{ uri: (viewingProfile || currentUser)?.avatarUrl || undefined }} style={styles.profileAvatar} /> : null}
                <Text style={styles.profileName}>{(viewingProfile || currentUser)?.displayName}</Text>
                <Text style={styles.profileHandle}>@{(viewingProfile || currentUser)?.handle}</Text>
                <Text style={styles.profileBio}>{(viewingProfile || currentUser)?.bio || 'No bio yet.'}</Text>
                {(viewingProfile || currentUser)?.websiteUrl ? <Text style={styles.profileDetail}>{(viewingProfile || currentUser)?.websiteUrl}</Text> : null}
                {(viewingProfile || currentUser)?.location ? <Text style={styles.profileDetail}>{(viewingProfile || currentUser)?.location}</Text> : null}
                <View style={styles.profileStats}>
                  <Text style={styles.profileStat}><Text style={styles.profileStatValue}>{(viewingProfile || currentUser)?.postCount || 0}</Text> posts</Text>
                  <Text style={styles.profileStat}><Text style={styles.profileStatValue}>{(viewingProfile || currentUser)?.followerCount || 0}</Text> followers</Text>
                  <Text style={styles.profileStat}><Text style={styles.profileStatValue}>{(viewingProfile || currentUser)?.followingCount || 0}</Text> following</Text>
                </View>
                <Text style={styles.profileMeta}>{(viewingProfile || currentUser)?.isPrivate ? 'Private account' : 'Public account'}</Text>
                {viewingProfile ? (
                  <Pressable style={styles.secondaryButton} onPress={() => followProfile(viewingProfile.id)} disabled={viewingProfile.relationshipStatus !== 'none'}>
                    <Text style={styles.secondaryButtonText}>{viewingProfile.relationshipStatus === 'following' ? 'Following' : viewingProfile.relationshipStatus === 'requested' ? 'Requested' : 'Follow'}</Text>
                  </Pressable>
                ) : (
                  <Pressable style={styles.secondaryButton} onPress={() => setEditMode(!editMode)}>
                    <Text style={styles.secondaryButtonText}>{editMode ? 'Cancel edit' : 'Edit profile'}</Text>
                  </Pressable>
                )}
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: '#cbd5e1', marginBottom: 6 }}>Ads watched: {adsWatched} / {adsRequired}</Text>
                  <View style={styles.progressBarBackground}>
                    <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.round((adsWatched / Math.max(1, adsRequired)) * 100))}%` }]} />
                  </View>
                  <View style={{ flexDirection: 'row', marginTop: 8 }}>
                    <Pressable style={[styles.smallAction, { marginRight: 8 }]} onPress={watchAd}>
                      <Text style={styles.smallActionText}>Watch ad</Text>
                    </Pressable>
                    <Pressable style={styles.smallAction} onPress={openRoulette}>
                      <Text style={styles.smallActionText}>Open roulette</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : null}
            {editMode && currentUser ? (
              <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Handle" placeholderTextColor="#94a3b8" value={profileEdit.handle} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, handle: value }))} />
                <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#94a3b8" value={profileEdit.displayName} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, displayName: value }))} />
                <TextInput style={styles.input} placeholder="Bio" placeholderTextColor="#94a3b8" value={profileEdit.bio} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, bio: value }))} />
                <TextInput style={styles.input} placeholder="Avatar URL" placeholderTextColor="#94a3b8" value={profileEdit.avatarUrl} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, avatarUrl: value }))} />
                <TextInput style={styles.input} placeholder="Website URL" placeholderTextColor="#94a3b8" value={profileEdit.websiteUrl} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, websiteUrl: value }))} />
                <View style={styles.row}> 
                  <Pressable style={[styles.smallTab, profileEdit.isPrivate && styles.smallTabActive]} onPress={() => setProfileEdit((prev) => ({ ...prev, isPrivate: true }))}>
                    <Text style={[styles.smallTabText, profileEdit.isPrivate && styles.smallTabTextActive]}>Private</Text>
                  </Pressable>
                  <Pressable style={[styles.smallTab, !profileEdit.isPrivate && styles.smallTabActive]} onPress={() => setProfileEdit((prev) => ({ ...prev, isPrivate: false }))}>
                    <Text style={[styles.smallTabText, !profileEdit.isPrivate && styles.smallTabTextActive]}>Public</Text>
                  </Pressable>
                </View>
                <Pressable style={styles.primaryButton} onPress={updateProfile}>
                  <Text style={styles.primaryButtonText}>Save profile</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.section}>
              <Text style={styles.sectionSubtitle}>{viewingProfile ? 'Posts' : 'My posts'}</Text>
              {(viewingProfile ? viewingProfilePosts : profileContent).map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <Text style={styles.postCaption}>{post.caption || 'Untitled post'}</Text>
                  {post.mediaItems?.[0]?.url && post.mediaItems[0].mediaType !== 'video' ? (
                    <View style={styles.postMediaFrame}>
                      <Image source={{ uri: post.mediaItems[0].url }} style={styles.postMediaImage} resizeMode="cover" />
                    </View>
                  ) : null}
                  {post.videoUrl || (post.mediaItems?.[0]?.mediaType === 'video' ? post.mediaItems[0].url : null) ? (
                    <View style={styles.postMediaFrame}>
                      <NativeVideoPlayer uri={post.videoUrl || post.mediaItems?.[0]?.url || ''} />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
            {viewingProfile ? (
              <Pressable style={styles.secondaryButton} onPress={() => { setViewingProfile(null); setEditMode(false); loadCurrentProfile(); }}>
                <Text style={styles.secondaryButtonText}>Back to my profile</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>

      {selectedStory ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.sectionTitle}>Story viewer</Text>
            <Text style={styles.profileHandle}>{selectedStory.creatorId}</Text>
            <View style={styles.storyMediaFrame}>
              {selectedStory.mediaType === 'video' ? (
                <NativeVideoPlayer uri={selectedStory.mediaUrl} />
              ) : (
                <Image source={{ uri: selectedStory.mediaUrl }} style={styles.postMediaImage} resizeMode="cover" />
              )}
            </View>
            <Pressable style={styles.secondaryButton} onPress={() => setSelectedStory(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {showRoulette ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.sectionTitle}>Roulette</Text>
            <Text style={{ color: '#cbd5e1', marginBottom: 8 }}>Options</Text>
            <View style={{ maxHeight: 160, marginBottom: 12 }}>
              {rouletteSession?.options?.map((opt, idx) => (
                <View key={idx} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: '#e6eef0' }}>{opt.label} - {(opt.probability * 100).toFixed(opt.probability < 0.001 ? 2 : 0)}%</Text>
                </View>
              ))}
            </View>

            <Animated.View style={{ alignSelf: 'center', marginVertical: 12, transform: [{ rotate: rotation.interpolate({ inputRange: [0, 4], outputRange: ['0deg', '1440deg'] }) }], }}>
              <View style={{ width: 160, height: 160, borderRadius: 80, backgroundColor: '#112218', overflow: 'hidden', borderWidth: 3, borderColor: '#ffcc2c' }}>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <View style={{ flex: 1, backgroundColor: '#c84b31' }} />
                  <View style={{ flex: 1, backgroundColor: '#e4a72c' }} />
                </View>
                <View style={{ flex: 1, flexDirection: 'row' }}>
                  <View style={{ flex: 1, backgroundColor: '#287c70' }} />
                  <View style={{ flex: 1, backgroundColor: '#5367a5' }} />
                </View>
                <View style={{ position: 'absolute', left: 48, top: 48, width: 64, height: 64, borderRadius: 32, backgroundColor: '#112218', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#ffcc2c', fontWeight: '700' }}>{spinning ? 'Spinning...' : 'Ready'}</Text>
                </View>
              </View>
            </Animated.View>

            {spinResult ? (
              <View style={{ marginVertical: 8 }}>
                <Text style={{ color: '#cbd5e1' }}>You won:</Text>
                <Text style={{ color: '#ffffff', fontWeight: '700' }}>{spinResult.label}</Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', marginTop: 12 }}>
              <Pressable style={[styles.primaryButton, { flex: 1, marginRight: 8 }]} onPress={spinRoulette} disabled={spinning}>
                <Text style={styles.primaryButtonText}>{spinning ? 'Spinning...' : 'Spin'}</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => { setShowRoulette(false); setRouletteSession(null); setSpinResult(null); }}>
                <Text style={styles.secondaryButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  hero: {
    paddingTop: 36,
    paddingBottom: 20,
  },
  eyebrow: {
    color: '#6bcc61',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    lineHeight: 22,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#15291f',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 14,
  },
  noteCard: {
    backgroundColor: '#0f1f17',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  noteTitle: {
    color: '#ffcc2c',
    fontWeight: '700',
    marginBottom: 6,
  },
  noteText: {
    color: '#94a3b8',
    lineHeight: 20,
  },
  container: {
    flex: 1,
    backgroundColor: '#07110a',
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#0f2119',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#ffcc2c',
    fontWeight: '700',
    fontSize: 22,
  },
  headerSubtitle: {
    color: '#cbd5e1',
    marginTop: 4,
  },
  logoutButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#6bcc61',
    borderRadius: 10,
  },
  logoutButtonText: {
    color: '#6bcc61',
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#15291f',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#ffcc2c',
  },
  tabText: {
    color: '#cbd5e1',
    fontWeight: '700',
    fontSize: 12,
  },
  tabTextActive: {
    color: '#ffcc2c',
  },
  statusBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#06120c',
  },
  statusText: {
    color: '#94a3b8',
  },
  connectionStatus: {
    color: '#6bcc61',
    fontSize: 11,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  mainContent: {
    padding: 20,
    paddingBottom: 60,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: '#d1d5db',
    marginBottom: 8,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0f1f17',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  input: {
    borderWidth: 1,
    borderColor: '#1f3328',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    backgroundColor: '#09170f',
    marginBottom: 10,
  },
  multilineInput: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: '#ffcc2c',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#111827',
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#6bcc61',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonText: {
    color: '#07110a',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  smallTab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#172e22',
    borderRadius: 12,
    alignItems: 'center',
  },
  smallTabActive: {
    backgroundColor: '#6bcc61',
  },
  smallTabText: {
    color: '#cbd5e1',
    fontWeight: '700',
  },
  smallTabTextActive: {
    color: '#07110a',
  },
  storyRow: {
    flexDirection: 'row',
  },
  storyBubble: {
    alignItems: 'center',
    marginRight: 12,
  },
  storyCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#6bcc61',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  storyCircleText: {
    fontSize: 24,
  },
  storyText: {
    color: '#f8fafc',
    fontSize: 12,
  },
  postCard: {
    backgroundColor: '#112218',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  postAuthorBlock: {
    marginLeft: 10,
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#172e22',
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#6bcc61',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#07110a',
    fontWeight: '700',
  },
  postAuthor: {
    color: '#ffffff',
    fontWeight: '700',
  },
  postHandle: {
    color: '#94a3b8',
  },
  postCaption: {
    color: '#e2e8f0',
    marginBottom: 10,
  },
  optionalFieldLabel: {
    color: '#d1d5db',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    marginBottom: 8,
  },
  productHelperText: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  productCard: {
    backgroundColor: '#0b1a11',
    borderWidth: 1,
    borderColor: '#2f4b39',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  productEyebrow: {
    color: '#6bcc61',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  productTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  productNotice: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 17,
  },
  affiliateDisclosure: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  productButton: {
    backgroundColor: '#ffcc2c',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 11,
    marginTop: 12,
  },
  productButtonText: {
    color: '#07110a',
    fontWeight: '800',
  },
  previewLabel: {
    color: '#fbbf24',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  postMediaFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#09170f',
    marginBottom: 12,
  },
  postMediaImage: {
    width: '100%',
    height: '100%',
  },
  nativeVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#09170f',
  },
  storyMediaFrame: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 520,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#09170f',
    marginBottom: 16,
  },
  postFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  postStats: {
    color: '#94a3b8',
    fontSize: 12,
  },
  engagementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  engagementButton: {
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  engagementButtonText: {
    color: '#ffcc2c',
    fontSize: 12,
    fontWeight: '700',
  },
  commentsPanel: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  commentText: {
    color: '#d1d5db',
    fontSize: 12,
    marginBottom: 6,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#1f3328',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#f8fafc',
    backgroundColor: '#09170f',
    marginTop: 4,
  },
  feedState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  feedStateText: {
    color: '#e6eef0',
    textAlign: 'center',
  },
  feedStateHint: {
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
  postMediaPlaceholder: {
    backgroundColor: '#09170f',
    borderRadius: 16,
    padding: 14,
  },
  postMediaText: {
    color: '#94a3b8',
  },
  sectionList: {
    marginTop: 12,
  },
  searchItem: {
    backgroundColor: '#112218',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  searchItemTitle: {
    color: '#ffffff',
    fontWeight: '700',
  },
  searchItemSubtitle: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  linkButton: {
    backgroundColor: '#ffcc2c',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  linkButtonText: {
    color: '#07110a',
    fontWeight: '700',
  },
  threadCard: {
    backgroundColor: '#112218',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  threadTitle: {
    color: '#ffffff',
    fontWeight: '700',
  },
  threadSubtitle: {
    color: '#94a3b8',
    marginTop: 4,
  },
  messageRow: {
    marginBottom: 8,
  },
  messageSender: {
    color: '#ffcc2c',
    fontWeight: '700',
  },
  messageText: {
    color: '#e2e8f0',
  },
  profileName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 4,
  },
  profileBanner: {
    width: '100%',
    height: 110,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: '#172e22',
  },
  profileAvatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: '#ffcc2c',
    marginBottom: 10,
  },
  profileHandle: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  profileBio: {
    color: '#d1d5db',
    marginBottom: 8,
  },
  profileDetail: {
    color: '#6bcc61',
    marginBottom: 5,
  },
  profileStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  profileStat: {
    color: '#94a3b8',
    fontSize: 12,
  },
  profileStatValue: {
    color: '#ffffff',
    fontWeight: '700',
  },
  profileMeta: {
    color: '#94a3b8',
    marginBottom: 10,
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: '#0b1a12',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 10,
    backgroundColor: '#ffcc2c',
  },
  smallAction: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#6bcc61',
    borderRadius: 10,
    alignItems: 'center',
  },
  smallActionText: {
    color: '#07110a',
    fontWeight: '700',
  },
  groupCard: {
    backgroundColor: '#112218',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupName: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  privacyPill: {
    color: '#07110a',
    backgroundColor: '#6bcc61',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  groupDescription: {
    color: '#cbd5e1',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  groupOwner: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 10,
  },
  closeText: {
    color: '#ffcc2c',
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#09170f',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  memberName: {
    color: '#ffffff',
    flex: 1,
  },
  memberRole: {
    color: '#6bcc61',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  pendingMembers: {
    marginTop: 12,
  },
  pendingNotice: {
    backgroundColor: '#172e22',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  pendingNoticeText: {
    color: '#ffcc2c',
    textAlign: 'center',
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayCard: {
    backgroundColor: '#0f2217',
    borderRadius: 24,
    padding: 20,
    width: '100%',
  },
});

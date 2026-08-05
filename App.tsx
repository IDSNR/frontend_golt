import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
const GOOGLE_PLACEHOLDER = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || 'replace-me-google-client-id';

type Tab = 'feed' | 'search' | 'dms' | 'profile';

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
  isPrivate?: boolean;
};

type Thread = {
  id: string;
  participantIds: string[];
  lastMessage: string;
  updatedAt: string;
};

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
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchProfiles, setSearchProfiles] = useState<Profile[]>([]);
  const [searchPosts, setSearchPosts] = useState<Post[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [viewingProfilePosts, setViewingProfilePosts] = useState<Post[]>([]);
  const [profileContent, setProfileContent] = useState<Post[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [profileEdit, setProfileEdit] = useState({ handle: '', displayName: '', bio: '', avatarUrl: '', isPrivate: false });
  const [newPostUrl, setNewPostUrl] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostType, setNewPostType] = useState<'image' | 'video'>('image');
  const [newStoryUrl, setNewStoryUrl] = useState('');
  const [newStoryType, setNewStoryType] = useState<'image' | 'video'>('image');
  const [newThreadRecipient, setNewThreadRecipient] = useState('');
  const [newThreadMessage, setNewThreadMessage] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const headers = useMemo(() => {
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      base.Authorization = `Bearer ${token}`;
    }
    return base;
  }, [token]);

  useEffect(() => {
    if (token) {
      loadCurrentProfile();
      loadFeed();
      loadStories();
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
  }, [activeTab, token]);

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
      setCurrentUser({ id: data.user.id, handle: '', displayName: data.user.displayName, bio: '', avatarUrl: '', isPrivate: false });
      setActiveTab('feed');
      setStatusMessage('Signed in successfully');
    } catch (error) {
      Alert.alert('Auth error', error instanceof Error ? error.message : 'Unable to continue');
    } finally {
      setLoading(false);
    }
  }

  async function continueWithGoogle() {
    try {
      setLoading(true);
      const data = await fetchJson('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email || 'google-placeholder@example.com',
          displayName: displayName || 'Google user',
          googleId: GOOGLE_PLACEHOLDER,
        }),
      });
      setToken(data.token);
      setCurrentUser({ id: data.user.id, handle: '', displayName: data.user.displayName, bio: '', avatarUrl: '', isPrivate: false });
      setActiveTab('feed');
      setStatusMessage('Signed in with Google placeholder');
    } catch (error) {
      Alert.alert('Google error', error instanceof Error ? error.message : 'Unable to continue');
    } finally {
      setLoading(false);
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
        isPrivate: Boolean(data.profile.isPrivate),
      });
      await loadMyContent();
    } catch (error) {
      console.warn(error);
    }
  }

  async function loadFeed() {
    try {
      const data = await fetchJson('/feed', { headers });
      setFeed(data.feed || []);
    } catch (error) {
      console.warn(error);
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

    try {
      const payload: any = { caption: newPostCaption || '' };
      if (newPostType === 'video') {
        payload.videoUrl = newPostUrl.trim();
      } else {
        payload.mediaItems = [{ id: 'new-media', mediaType: 'image', url: newPostUrl.trim(), orderIndex: 0 }];
      }
      await fetchJson('/content', { method: 'POST', headers, body: JSON.stringify(payload) });
      setNewPostUrl('');
      setNewPostCaption('');
      setStatusMessage('Post created');
      await loadFeed();
      await loadMyContent();
    } catch (error) {
      Alert.alert('Post failed', error instanceof Error ? error.message : 'Unable to create post');
    }
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
        <Text style={styles.headerTitle}>PartnerHub</Text>
        <Text style={styles.headerSubtitle}>Feed, stories, search, DMs, profile</Text>
      </View>

      <View style={styles.tabRow}>
        {renderTabButton('feed', 'Feed')}
        {renderTabButton('search', 'Search')}
        {renderTabButton('dms', 'DMs')}
        {renderTabButton('profile', 'Profile')}
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusText}>{statusMessage || `Signed in as ${currentUser?.displayName ?? 'you'}`}</Text>
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
              {feed.map((post) => (
                <View key={post.id} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.avatarCircle}><Text style={styles.avatarText}>{post.creatorDisplayName?.charAt(0) || 'U'}</Text></View>
                    <View>
                      <Text style={styles.postAuthor}>{post.creatorDisplayName || post.creatorId}</Text>
                      <Text style={styles.postHandle}>{post.creatorHandle || post.creatorId}</Text>
                    </View>
                  </View>
                  <Text style={styles.postCaption}>{post.caption}</Text>
                  {post.mediaItems?.length ? (
                    <View style={styles.postMediaPlaceholder}>
                      <Text style={styles.postMediaText}>{post.mediaItems[0].url}</Text>
                    </View>
                  ) : null}
                  {post.videoUrl ? (
                    <View style={styles.postMediaPlaceholder}>
                      <Text style={styles.postMediaText}>{post.videoUrl}</Text>
                    </View>
                  ) : null}
                </View>
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
                <Text style={styles.profileName}>{(viewingProfile || currentUser)?.displayName}</Text>
                <Text style={styles.profileHandle}>{(viewingProfile || currentUser)?.handle}</Text>
                <Text style={styles.profileBio}>{(viewingProfile || currentUser)?.bio || 'No bio yet.'}</Text>
                <Text style={styles.profileMeta}>{(viewingProfile || currentUser)?.isPrivate ? 'Private account' : 'Public account'}</Text>
                {viewingProfile ? null : (
                  <Pressable style={styles.secondaryButton} onPress={() => setEditMode(!editMode)}>
                    <Text style={styles.secondaryButtonText}>{editMode ? 'Cancel edit' : 'Edit profile'}</Text>
                  </Pressable>
                )}
              </View>
            ) : null}
            {editMode && currentUser ? (
              <View style={styles.card}>
                <TextInput style={styles.input} placeholder="Handle" placeholderTextColor="#94a3b8" value={profileEdit.handle} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, handle: value }))} />
                <TextInput style={styles.input} placeholder="Display name" placeholderTextColor="#94a3b8" value={profileEdit.displayName} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, displayName: value }))} />
                <TextInput style={styles.input} placeholder="Bio" placeholderTextColor="#94a3b8" value={profileEdit.bio} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, bio: value }))} />
                <TextInput style={styles.input} placeholder="Avatar URL" placeholderTextColor="#94a3b8" value={profileEdit.avatarUrl} onChangeText={(value) => setProfileEdit((prev) => ({ ...prev, avatarUrl: value }))} />
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
                  {post.mediaItems?.[0]?.url ? <Text style={styles.postMediaText}>{post.mediaItems[0].url}</Text> : null}
                  {post.videoUrl ? <Text style={styles.postMediaText}>{post.videoUrl}</Text> : null}
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
            <Text style={styles.postMediaText}>{selectedStory.mediaUrl}</Text>
            <Pressable style={styles.secondaryButton} onPress={() => setSelectedStory(null)}>
              <Text style={styles.secondaryButtonText}>Close</Text>
            </Pressable>
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
  headerTitle: {
    color: '#ffcc2c',
    fontWeight: '700',
    fontSize: 22,
  },
  headerSubtitle: {
    color: '#cbd5e1',
    marginTop: 4,
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
  profileHandle: {
    color: '#94a3b8',
    marginBottom: 8,
  },
  profileBio: {
    color: '#d1d5db',
    marginBottom: 8,
  },
  profileMeta: {
    color: '#94a3b8',
    marginBottom: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
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

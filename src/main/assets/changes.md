## (09/10/2024) Some improvements + some behind-the-scenes stuff

I've decided to make all the live streamer open source and available to anyone.
To do this I've had to separate a lot of the cabtv functionality from the live streamer stuff, making the cabtv part almost like an addon. You won't notice much difference but behind the scenes there are significant changes.

The source is separated into modules. The 'main' module is where most of the action happens:

[https://github.com/twilson90/livestreamer](https://github.com/twilson90/livestreamer)  
[https://github.com/twilson90/livestreamer-main](https://github.com/twilson90/livestreamer-main)  
[https://github.com/twilson90/livestreamer-media-server](https://github.com/twilson90/livestreamer-media-server)  
[https://github.com/twilson90/livestreamer-file-manager](https://github.com/twilson90/livestreamer-file-manager)  

**Live Streamer Bug fixes and improvements:**

- Live Streamer UI more responsive. Latency reduced to bare minimum, There was originally an imposed minimum of a 0.5 second delay between the UI and server response to any significant interaction, eg. playing a new item in the playlist. Now it's been optimized to whatever the network latency is, so <100ms or there abouts.

- UI glitches like seek bar flickering after seeking or screen flicker after changing sessions fixed. Generally less flickers all round.

- Stream Settings at the top is now a movable/collapsible panel like the rest of the interface. Also includes additional information about the stream.

- Past streams to CAB TV's local media server are remembered for 2 days now instead of just 1. Could make it longer but often at risk of filling the server's harddrive.

- Removed Playlist header button 'Toggle Scheduled Times' which replaced playlist item duration with Start Time. However it was totally broken and was too complicated to fix so opted to remove it.

- Added automatic crop detection to CAB TV media player, it is now a default setting but can be toggled by clicking the button labeled "AUTO" to cycle through options. 
As I'm sure you've all experienced on the site, viewing something filmed in 4:3, encoded into a 16:9 stream, presented in a 4:3 window presents the issue of black borders on all sides and making the image smaller than necessary. This isn't something easily fixed but I decided to have a go and ended up writing my own crop detection algorithm that works in the browser and it appears to work surprisingly well, however it's not perfect and can become confused with very dark scenes.
It adds a bit of extra work for the CPU but I'm hoping it's slight enough that it won't be an issue.
It will only crop to preset areas that are common for 16:9 or 4:3 videos, which is also necessary to prevent it going nuts.
This option (like volume & time display mode) is remembered by the browser.

- For CAB TV media player the cropping options are now a little better situated *inside* the player if that makes sense.

- Better UI for canceled playlist uploads. Items that did not fully upload are now clearly marked with an upload icon and the word 'Canceled'.

- Uploads over a spotty connection should be a less prone to completely failing if the user briefly disconnects. This was already implemented but a bug was causing it to be much less forgiving.

- 'Encoder Panel' renamed to 'Stream Metrics'. The panel now displays graphs for bitrate as well as speed which can be toggled with 2 new buttons. Graph now includes the entire metric's history. Use mouse wheel to zoom and click/drag to pan. Double Click to reset zoom/pan

**Website Improvements and Fixes**

- Updated the theme to a new (but not too different) look.

- Added a link to the Live Streamer in the wordpress admin bar.

- Fixed CAB TV Settings admin page (setting Private Live / Private Go Lives now works).

- Added cooldown visualization to chat + gift sends on /live.

## (26/03/2024) Just Another Update

A load of new features and improvements behind the scenes, as well as some practical and (hopefully) not too confusing changes:

- **New Streaming Server**

    It's no longer necessary to rely on third party services like ok.ru, vk.com, etc. Live Streamer can now serve live playback publicly on its own media streaming server!  
    Due to the relatively small viewing audience it should be possible to serve everyone at once without using too much bandwidth.  
    In your stream configuration just add the new target 'CAB TV Media Server'.  
    The video interface shown to viewers on /live also has some cool features, you can rewind up to 2 hours of the stream, you can choose between various video qualities & resolutions, you can change the aspect ratio without obscuring the UI, and you can change the speed of the video (useful if you're behind and you want to catch up without missing anything)  
    Implementing this new feature set led to a lot of other changes outlined below...  

- **Live Streamer Updates**
    
    - A new & improved system for handling multiple output targets that allows you to alter them on-the-fly!  
    Originally, if there was a target that was slow or offline it could affect all other targets and possibly stall the entire stream.  
    Now the playback of the live stream is entirely detached from the status of various targets.  
    If a target goes offline or fails in some way, the media server will attempt to reconnect automatically.  
    You can also add or remove targets during the stream without having to stop and restart, via the...  

    - New 'Stream Configuration' menu, accessible by clicking the cog wheel next to the 'Handover' button after starting a stream.  
    Also accessible for external streamers (i.e. Flouncer)
    Allows you to change some settings mid-stream, like targets or the new 'Stream Title' property.  

    - Due to the new target system, the speed graph now shows individual graphs for the transcoding process (originally named 'mpv' but renamed to 'trans') and each output target. This allows you to monitor the transfer rate for each target. The graph rendering is also a bit more responsive now.  

    - New 'Legacy Mode' and 'Hardware Transcoding' stream configuration properties.  
    For now 'Legacy Mode' is enabled and 'Hardware Transcoding' is disabled by default.  
    Enabling 'Legacy Mode' just uses a new (but not necessarily better) media encoding process behind the scenes. When enabled, this also allows for the new 'Hardware Transcoding' support to be enabled. It's questionable whether or not Hardware Transcoding is any faster or more efficient on the server, I still need to run some tests. Feel free to give it a go, but consider it 'experimental' for now.

    - New 'Frame Rate' property to stream configureation (default value 'Variable')  
    This was originally a per-file property and was always assumed 'Variable' but now you can set it to a fixed frame rate and it will remain like that for the duration of the stream. Fixed frame rates can often resolve certain issues with video / audio misalignment. I'd still recommend keeping it at 'Variable' though.  

    - Improved Test stream functionality. Playback loads almost immediately and plays closer to the live edge.  

    - New 'Local File System Tree' menu, represented by a button with a file-tree icon next to the footer 'File Manager' button.  
    This menu displays the entire 'Files' folder as an expandable table of file names and sizes. It's sorted in descending order of file size so you can quickly find what files and folders are using up the most space, which is very useful for monitoring hard drive space.  
    Clicking an arrow next to a folder or collection of files expands / collapses them, clicking the file name opens the file manager at the location of the clicked file.  

    - 'Resolution' options have been simplified.  

    - Brought back a new implementation of Playlist sticky toggle, when enabled the playlist panel will fit the vertical space with the header and footer always visible.  

    - Renamed 'Setup OBS' to 'Setup External Session'. Menu now has additional 'id' field that is necessary for external streamers.  

    - 'Change Log' button pulsates with a light blue glow whenever the changelog has been updated.  

- **/live page updates**

    - Chat improvements and changes:
        - New infinite scroll feature  
        Scroll upwards to reveal every comment ever written (up to 4,000 comments ago).  
        - Throroughly improved mobile experience for Chrome and Firefox (possibly Safari but I can't test it without an Apply device). 
        - Chat scroll position is properly maintained when the window is resized (it used to get a little bit offset and cause the chat to pause).  
        - Improved performance, especially when displaying many comments.  
        - Visible time stamps on every comment. This can be toggled off/on in the settings.  
        - If a long period of time passes between comments (30 minutes or longer) an additional entry will appear above the latest comment displaying 'n hours ago'.  

    - Improved live stream thumbnail scroller:
        - Live stream thumbnails are now situated within a tab group containing 2 tabs, 'Live' & 'Expired'.  
        'Live' includes all the currently streaming live streams.  
        'Expired' contains all the live streams detected in the last 24 hours that have been detected as being offline or are no longer 'attached' to a Go Live.
        Prior to this, the moment a live stream was deemed 'finished' it would disappear from view and become inaccessible, now they remain for 24 hours.  
        By separating live streams into groups it potentially reduces clutter in the UI, this new way also allows for old live streams to be viewed for a limited time (like new cabtv streams or vk.com streams)  
        The new scroller can also be moved with touch scrolling.  
        - Live stream thumbnail dropdown button now responds to right click.  
        - Live stream duration shown on thumbnail (hh:mm).  

    - Text entry on mobile/touch devices is now a lot less crap. Originally, when focused on the chat entry text field the page would scroll down or the text field would become obscured by the keyboard UI. Now the text field will reposition itself above the keyboard UI so you can see what you're typing and the page is locked in place to prevent scrolling. Unfortunately there is an issue on Firefox mobile in fullscreen mode that prevents this working.  

    - New auto focus feature. When interacting with the video or chat the page will automatically scroll to the ideal position to view both within the window. This is mostly necessary for mobile users but is also enabled for desktop user. This can be toggled on/off in the settings.  

    - The chat popout feature has been redesigned so it now opens in a new independant page that can be accessed via a url and bookmarked: https://cabtv.co.uk/live/?chat=1  
    Originally it would open in a window that was inextricably linked to the parent window, closing the parent would close both of them.  

    - Optimizations and UI improvements for mobile, better performance generally.  

    - The default live stream loaded on page load is better intuited now. It had a tendency to load nothing before, requiring a manual action.  

    - Removed live stream title bar and external link at the top of a live stream, moved to the footer below.  

    - Resizing the window and collapsing the chat sidebar is more fluid and responsive.  

    - TV static will display in the viewing area when no live stream is selected (this can be disabled in the settings menu)  

    - Additional setting 'Show Gifts' (default: yes).  

    - Gifts now display in chat window if popped out.  

- **Go Live changes**

    Added various new options when posting a Go Live that were originally assumed values.  
    Go Lives are not just a way for posting notifications, but a way of providing vital information to the server about your stream.  

    - Stream URLs  
    Now just a single text area input, 1 url per line. Leaving it blank will make the Go Live 'indeterminant' and basically just functions as a notification.  
    Or you can add supported URLs (YouTube, Twitch, ok.ru, vk.com, etc.) to make them appear on the /live page.  

    - Show Multiple Streams  
    Enabling this will allow you to show multiple streams side-by-side, as demonstrated a while ago with some gaming sessions.  

    - Thumbnail  
    Attach an image to show as the live stream thumbnail on the /live page and in push notifications.  

    - Auto Finish  
    This was always assumed true but now it's optional. Auto finishing is also better handled on the server now.  

- **Miscellaneous**

    - All the publicly served javascript was originally served using a modern standard that meant some older browsers would have trouble parsing it, leading to all sorts of issues. Now it's all compiled into a more backwards compatible version of javascript that should result in fewer compatibility issues on older browsers.  

    - Significantly improved script execution time on /live and live streamer, less likely to lag in your browser, especially on mobile.  

    - Significant security improvements.  

    - Dark/light mode button bug fixed.  

    - Fixed 'Load More' button on Shows pages.  

---------

## (28/04/2022) Nested Playlists, Timeline Mode, etc.

<figure>
  <img height="240" src="https://i.imgur.com/96VYDDm.gif" alt="Al" loading="lazy">
</figure>

- **New nested playlists functionality.**  

    You can now have playlists within playlists (...within playlists!)  
    Clicking the new 'Add Playlist' button in the '•••' popout menu will add an empty playlist item to the current playlist.
    A playlist has the configurable property 'Playlist Mode'. It has 3 options:  

    - Normal (Default)  
        Just a folder. Useful for organizing your main playlist into groups.  
    - Merged  
        In this mode, the playlist's contents are processed like a single seamless sequence of media clips.  
        Allows you to add a single audio track to the playlist via the Modify menu to run over a sequence of video items, or play a single video-loop over a sequence of audio items.  
    - 2-Track  
        This mode is similar to 'Merged', but the playlist is now split into 2 tracks, the first for video and the second for audio.  
        Try sequencing a music playlist in the audio track to play over a montage of video clips. It can produce some really cool results.  

    Due to the way 'Merged' and '2-Track' playlist modes are implemented, the items within are limited to local files and empties. The contained items also have significantly less configurable properties in the Modify menu (mainly just properties for clipping and looping).  
    Normal playlists have none of these limitations.  
    There's no limit to the levels of recursion within playlists. You can have a 2-track playlist within a merged playlist or vice versa. However a 'normal' playlist within a 'merged' or '2-track' playlist will take on the properties of the dominant playlist parent.

    In the following example, the right side effectively shows the way a merged playlist and its contents are flattened into a single file when played:

        Playlist (merged)                      Merged File (0:50)         
        ├── Playlist (normal)                  ├── file1.mp4 [chapter 1]  
        │   ├── file1.mp4 (0:10)               ├── file2.mp4 [chapter 2]  
        │   └── file2.mp4 (0:10)      ===>     ├── file3.mp4 [chapter 3]  
        ├── Playlist (merged)                  ├── file4.mp4 [chapter 4]  
        │   ├── file3.mp4 (0:10)               └── file5.mp4 [chapter 5]  
        │   └── file4.mp4 (0:10)                                          
        └── file5.mp5 (0:10)                                              

- **New 'Timeline' Mode:**  

    Now you can now view and interact with your playlist as a horizontal timeline, similar to the UI in video editing software.  
    This mode is especially useful for editing 2-Track playlists, to accurately visualize the start and end of items for easy alignment.  
    Activate Timeline mode by selecting the dropdown box in the Playlist panel and selecting 'Timeline'.  
    Zoom in and out with the mouse wheel, or on mobile with pinch gestures.  
    Additional buttons are revealed in the Playlist panel header when Timeline mode is active:
        - Go to Playhead: Moves the view to show you the playhead if the item is playing.
        - Zoom Into Selection: Zooms in or out to the show your selected items. If no items are selected, will zoom out to show the entire timeline.
        - Incremental xoom in & zoom out buttons & an input for setting the precise zoom percentage.

- **New playlist context menu items:**  

    - Enter Playlist [Enter]  
        Enter a playlist item & edit the contents. 
    - Add to New Playlist [Ctrl+G]  
        Groups the selected items to a new playlist item.
    - Breakdown Playlist [Ctrl+U]  
        Ungroups the selected playlist items to the parent playlist (the opposite action of 'Add to New Playlist').
    - Cut [Ctrl+X]  
        Additional clipboard functionality, moves an item instead of duplicating. Works across playlists & sessions.
    - Rename [F2]  
        Quickly rename a playlist item (the same as editing the item's Label property in the Modify menu)
    - Split...
        Allows you to split an item into clips with several methods:  
        - \# of parts: Evenly splits an item into n parts.  
        - Duration: Splits an item every specified time span.  
        - List of Time Codes: Splits an item at specified times.  
        - Every Chapter: Splits an item into individual chapters.  
        - List of Chapters: Splits an item at specified chapters.  
        Also can manually add cuts using mouse or touch gestures to a timeline interface.  
    
    Additionally, almost every context menu item has a keyboard shortcut now (see Controls menu for additonal shortcuts)

- **New 'Save Playlist' button in '•••' popout menu**  

    Save a playlist's contents to a file locally or remotely (on the server) in a simple and readable JSON format, which can later be loaded in the 'Add File' interface, or simply stored for archiving purposes.

- **New configurable 'Stream Target' system**  

    The stream delivery system has been significantly redesigned.  
    Prior to changes, each session had a target (rtmp host & key or restream.io) and the optional choice of a backup target.  
    All of this has been replaced by the more configurable property 'Stream Targets', which allows you to pick 1 or more predefined targets and define order of priority.  
    This allows for unlimited parallel backup streams if you desire.  
    You can also add your own targets, with additional access control to allow/prevent other users seeing or editing them.  

- **Improved & expanded clipping properties in Modify menu**  

    Renamed 'Start Time' and 'End Time' to 'Clip Start' and 'Clip End'  
    Added additional property 'Clip Loop' for setting the number of times the specified clip repeats.
    Also added 'Clip Offset', 'Total Duration' & a slider for setting the clipping range.

- **Improved UI**  

    - Items that are clipped or looped are graphically represented in the playlist (similar to video editing software).  
    <!-- - The insertion point for new items in the playlist is now represented with a green dashed line.   -->
    - Additional button '<i class="far fa-clock"></i>' in Playlist header for toggling item's duration display (default) or the time of day the item is scheduled to start.
    - Added Playlist Info bar to display the number of selected playlist items & their duration, items present on your clipboard and 'Select All' / 'Deselect All' buttons.  
    - Fixed messed up scrolling on menus.  
    - Added drag handle to session tabs for easier scrolling / rearranging of session tabs.  
    - Various improvements for small screens and touch devices (i.e. mobiles, tablets).
    - Currently playing file name text in Media Player panel is now clickable, highlighting & scrolling to the file in the playlist.
    - Seek bar UI improved.  

- **Altered & improved behaviour for 'Image / Video Loop File' property.**  

    In the Modify menu 'Image / Video Loop File' has been replaced with a new property 'Add Video' which contains several options:  
    - 'Default Background' (i.e. equal to the property set in the Session Configuration menu)  
    - 'Black'  
    - 'Logo'  
    - 'Embedded Artwork'  
    - 'Embedded or External'  
    - 'Image/Video File'  
    To replicate the old behaviour, just set it to 'Image/Video File'  
    This change was implemented to standardize the way Empties, Intertitles and other items apply configurable backgrounds.  
    If set to 'Image/Video File' and the specified file is non-existant or invalid, internally it will always fallback to 'Default Background'  

- **Improved Intertitle settings**  

    Loads of new properties: Font, Size, Color, Style, Alignment, Letter Spacing, Underline, Margin, 3D Rotation, Outline, Shadow.  
    And options for configuring the background and adding audio.  
    A box will render the results to show how the intertitle will look when played.  

- **Combined 'Current File Settings' & 'Default File Settings' into single panel titled 'Media Settings'**  

    Media Settings panel now has 2 modes represented by 2 buttons in the top right: 'Current' & 'All'  
    Modifying properties in 'All' mode will affect the currently playing item and all other items.  
    Modifying properties in 'Current' mode will affect only the currently playing item. On loading a new item the settings will revert to its 'All' setting.  

- **File Manager Web UI overhaul**  

    - Created a new file manager server (from scratch!) for greatly improved performance and loading times.  
    - Upload handling through UI improved, possibly faster than alternative FTP method.  
    - Large directories load in a fraction of the time than they used to.  
    - Fixed vertical resizing bug.  
    - Added context menu function for folders 'Download tree listing'. Generates & downloads a text file with the entire directories contents in a readable format.

- **New alternative upload method**  

    Now you can upload files by clicking the new 'Upload Files...' button at the bottom of the playlist or by dragging files / folders over the playlist. All files are placed in the 'Uploads' volume in the file manager.

- **New 'Volume Transition Speed' property in Media Player panel**  

    Changing the volume in the middle of a programme would often result in a very sudden change, so I've added a property to allow for a more gradual change in volume. By default it is set to 'Slow' but you can speed it up, slow it down further, or turn it off by setting it to 'Immediate'.

- **New 'Precise Volume Adjustment' menu (access by clicking the volume percentage)**  

- **Better YouTube error handling.**  

    If a YouTube video fails to play or download for unforeseen reason (eg, Geo-restricted, age-restricted) a descriptive error will appear in the Log.  

- **New 'Auto Reconnect' functionality in Session Configuration.**  

    When configured, on an unexpected disconnect while streaming (crash or network interrupt), the streamer will attempt to restart the stream from the point of disconnect automatically. Operates similar to the way OBS handles disconnects.  
    Not sure how useful this functionality is but I added it anyway...  

- **Modify menu now prompts user to reload if settings changed while the file is currently playing, so changes can take immediate effect.**  

- **New Schedule Generator option 'Use Labels'.**  

    When set to 'Yes' uses the playlist item's label (if set) instead of the filename.

- **Added several buttons to foot of page:**  

    - File Manager: Replaces the Wordpress admin section 'File Manager' in the sidebar. Opens the file manager for viewing purposes.  
    - Setup FTP: Displays FTP details.  
    - Process Manager (for admins only): Allows an admin to easily stop, start or restart a process.
    - Controls: Display a menu listing all the common keyboard shortcuts and mouse controls.  
    - Change Log: Displays the change log.  

- **New rearrangable layout system**  

    Panels are now rearrangable by dragging the header. Layout can be reset in the Client Configuration menu.

- **URL item improvements**  

    - Improved 'Add URL' menu that allows for multiple lines of URLs to be inserted into the playlist.  
    - On inserting a youtube URL representing a playlist, the playlist and its contents are now inserted as a playlist item.  
    - Fixed various issues with URL based items that prevented loading.  

- **Fixed formatting on Firefox showing seconds and milliseconds on Schedule Stream 'Start Time' input. Now only shows hours and minutes (as intended).**  

- **Encoder graph is now time-based instead of frame-based, now shows a flatline if the encoding stops unexpectedly.**  

- **Improved playback performance for complex playlist items. (Fixes playback issue user *the* experienced with 60fps additional video *"London Walk - Aldgate east to London Eye (Starting Daylight and finish at night).mp4"*)**  

- **Added decoder support for new av1 video codec (Fixes playback issue user *the* experienced with *"How It's Made Wax Figures-720p.mp4"*)**  

- **Modularized entire backend for better performance and failure management. The main process, media server & file manager are now independant modules, so if one fails and/or restarts, the rest will remain running.**  

---------

## (07/11/2021) Minor fixes

- **(Fix) Playlist files were not being probed at a fixed interval rate (currently set to be probe every 5 minutes), so deleted/altered files were not reflected in the playlist UI.**  

- **(Fix) filename property in modify menu for URL based filenames was showing as invalid.**  

---------

## (06/11/2021) A few fixes...

- **(Fix) Fade in/out for intertitles were not working.**  

- **(Fix) Back-to-back intertitles in a playlist would only play the first item.**  

- **(Fix) Current/Default File panels were back to front! Caused a bit of confusion.**  

---------

## (03/11/2021) The mini Macro update!

- **New 'Macro' playlist items (in '•••' playlist menu, 'Add Macro').**  
    The item has no duration. On playing this item, a specified function is run and the playlist immediately loads the next item if the function has not stopped streaming.  
    Currently the only functions available are 'Stop' or 'Handover', allowing the user to schedule these actions instead of using the buttons.  
    If you have suggestions for more possible functions please let me know.

- **New playlist context menu option 'Reveal in File Manager'.**  
    Opens the file manager to the directory where the selected item is located.  

- **Added 'Change Log' popup to display any recent changes made to the Live Streamer.**  
    Also added 'Show Change Log' button at footer of page.

- **Much improved layout and interface for mobile & touchscreen.**  

- **Added vertical 3 dots button for playlist items to open the context menu (only visible for touchscreen devices without ability to right click).**  

- **Instated new policy for Downloads (ie, anything downloaded in the live streamer via the playlist item context menu).**  
    Any file downloaded older than 180 days and no longer referenced in the playlist of any sessions will now be deleted on a daily basis.  
    This is mainly to prevent excessive clutter in the downloads directory and freeing up storage space on the server.  

- **Attempted fix for Firefox whereby streamer updates were applied slowly after period of being in a deactivated state (minimized window or focusing on another tab).**  

- **(Fix) 'Crop Detect' bug.**  

- **(Fix) Stop/start streaming bug (says 'stopping streaming' and unable to stop/start again).**  

- **(Fix) log history disappearing bug.**  

- **(Fix) playlist re-arranging bug.**  

---------

## (22/10/2021) Mega update!

- **New improved layout with collapsible panels.**  

- **New Client Configuration options (User icon button, top right) and toggle buttons:**  
    \[Playlist\] Line Wrap  
    \[Playlist\] Show Codecs  
    \[Playlist\] Sticky Mode  
    \[Media Player\] Show Milliseconds  
    \[Media Player\] Show Chapters  
    \[Sessions\] Display Mode  
    \[File Manager\] Open in New Window  
    \[Encoder\] Data Limit  
    \[Encoder\] Show Stats  

- **New feature: Session Configuration (Cog wheel button, top left when inside a session).**  
    Relocated various settings like 'Session Name', 'Default Background Media' & 'Default Background Media File'

- **New Session Configuration setting: 'Preferred youtube-dl Download Directory'**  
    Choose a special directory to save your youtube-dl downloads.

- **New Session Configuration setting: 'Access Control'**  
    This replaces the old 'User Lock' feature with something more sophisticated.  
    Now you can claim ownership of a session and choose who is allowed or denied access.  
    Owners can set all users to be denied or allowed access with the * user.  
    You may also set a password for access.  
    Users with access but without ownership are denied the ability to load, save, rename, delete or change any options in the Session Configuration interface.  
    (Note to regular streamers - you have been assigned ownership to your pre-existing sessions, but by default all users have access to it, you may change this if you wish.)  

- **New feature: History (button next to Save):**  
    Internally the session is autosaved every minute and a history of upto 256 saves are preserved.  
    Need to revert changes back to an earlier date? Open the History interface and choose a previous save to load.  
    Changes between the current session and the previous save are displayed as a list, to hopefully help you identify which changes you want to revert.  

- **New playlist button '•••' popout menu, includes some right click menu buttons and some new ones.**  

- **New Feature: Add RTMP Stream.**  
    Inserts an rtmp stream as a playlist item, named 'livestreamer://rtmp'  
    Connect and stream to the server (in OBS or other streaming software) and it will broadcast when this item is played.  
    Open Session Configuration and you'll see 2 properties: Stream Host and Stream Key. Use these to configure your streaming software. The Stream Key can be regenerated by clicking the button with the reload icon.  
    When you are streaming to your session, you should notice the connection icon next to 'livestreamer://rtmp' go green. When disconnected it turns orange.  
    Currently there is a delay of about 4 seconds between starting the item and it playing, which I'll try to improve.  

- **New feature: Add Intertitle.**  
    Add short title cards to introduce a media item that might benefit some basic description.  
    Options: 'Font size', 'Duration', 'Fade in/out'  

- **New Stream Method: 'Test Stream'**  
    Starting a stream with this method will not show up on the site's Live page, but will play in a small box in the streamer interface. Useful for testing things out.  

- **Improved Seek bar**  
    Hovering over any position in the seek bar displays the time code and chapter name at that specific point.  
    Also added small vertical lines to indicate units of time.  

- **New Panels: 'Current File Settings' & 'Default File Settings'**  
    Just as before, media player settings revert to their defaults on loading the next playlist item.  
    'Current File Settings' retains exactly this behaviour.  
    'Default File Settings' now allows you to choose what default settings to revert on loading each item.  
    For instance: Volume Normalization set to 'Off' in 'Current File Settings' will now revert to 'dynaudnorm1', unless it is also set to 'Off' in 'Default File Settings'  

- **New file setting: 'Audio Channels' with options 'Stereo' and 'Mono'**  
    By selecting 'Mono', the streamer will downmix any stereo audio (which might have one channel much quieter than the other) to mono, fixing any 'bad' stereo issues.  

- **New improved playlist item 'Modify' interface:**  
    Includes all the 'File Settings' and some new extras:  
    - Volume Multiplier:  
        Setting this will not affect the Media Player's 'Volume' slider, but will still apply. Useful if you need to turn off 'Volume Normalization' for a particular file and pre-apply a volume when the file is loaded.  
    - Fade In/Out Duration:  
        Applies a black fade to the beginning/end of the file. Also fades the audio.  
    - Video Loop Start/End Time:  
        (Applies for attached Video Loop File) Set the start and end time of the video loop, set a segment to loop instead of the entire file.  
    - Improved Crop Detect:  
        On running crop detect you will be returned a series of frames from the video, each with their own detected crop region. By clicking on the image you can then adjust the crop rect precisely in a new GUI.  
    - Item Color:  
        Simply changes the color appearance of the item in the playlist. A handy visual aid for categorising.  

- **New Streaming control button 'Handover':**  
    After starting a stream, next to the 'STOP' button, you'll see 'Handover'  
    Then select another session from the dropdown and click OK to seamlessly handover the stream to another session.  
    No more crashing halt & confusion when another streamer wants to take over.  

- **Reload Button in Media Player panel now indicates pending changes to current file.**  
    When settings are changed in 'Default File Settings' or 'Modify' interfaces, the item needs to be reloaded for these changes to take effect.  
    If any changes are detected it will show a red exclamation mark ontop of the Reload button.  

- **New Media Player button: Precise Seek (the clock icon in the 'Media Player' panel)**  
    Allows precise seeking to a timecode or chapter.  

- **Improved Encoder graph and interface:**  
    Now displays individually the rate of the media encoder (MPV) and the network delivery (ffmpeg)  
    Also displays a min, max and average value for each.  

- **Added Keyboard controls & shortcuts**  
    - Ctrl+<1-9> opens a session corresponding to its order (Ctrl+1 opens the first session)  
    - Ctrl+0 closes the session.  
    - Ctrl+s saves the session to file.  
    - Playlist:  
        - Up/Down => to select individual items (hold Shift to expand selection or Ctrl to toggle)  
        - Ctrl+a => selects all  
        - Ctrl+d => deselects all  
        - With one or more playlist items selected:  
        - Delete => delete selected  
        - Enter => play selected  
        - Ctrl+c => Copy selected to clipboard  
        - Ctrl+v => Paste  

- **New Feature: Clicking the current file name text in the Media Player UI highlights and scrolls to the corresponding item in the playlist.**  

- **Improved Schedule Generator (now found in Playlist '•••' popout menu)**  

- **Help icons - little question marks next to labels with a description of the property.**  

- **youtube-dl slow download issues should be resolved.**  

- **Various media encoder improvements:**  
    You may notice the time display next to the seek bar is now a lot less jumpy as it now encodes at a rate much closer to realtime than before.  
    As a result, you will also notice the encoder graph plots a lot more peaks and troughs now, but don't be alarmed, it's just a more accurate estimation of the rate of encoding. As long as the averages around 1.000x speed then it's running smoothly.  
    Files with unexpected discontinuities, corrupted chunks or other faults, should now continue to play (with the decoder's best efforts) instead of failing and skipping to the next playlist item.  
    (Note - As much as it's been tested, please be on the look out for any weird quirks, audio sync problems, files that refuse to play, etc.)  

- **At the end of a playlist, it will no longer add an item named 'livestreamer://empty', but in effect it will still do exactly the same thing, i.e. play an infinite loop of the logo until you stop the stream.**  
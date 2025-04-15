let sameNumberOfSubscriptions;
let dateTimeToSearchBackForVideos;
let numberOfRecentVideosToCache = 500;

function setSearchBackDateTime()
{
  dateTimeToSearchBackForVideos = new Date();
  dateTimeToSearchBackForVideos.setMinutes(dateTimeToSearchBackForVideos.getMinutes() - 30);
}

function checkIfSubscriptionCountChanged()
{
  let pageToken;
  const list = YouTube.Subscriptions.list(['snippet'], {
    "maxResults": 50,
    "mine": true,
    ...(pageToken && { pageToken })
  });

  var numberOfSubscriptions = parseInt(list.pageInfo.totalResults);
  
  if (PropertiesService.getScriptProperties().getProperty("numberOfSubscriptions") == null)
    PropertiesService.getScriptProperties().setProperty("numberOfSubscriptions", "0");

  cachedNumberOfSubscriptions = parseInt(PropertiesService.getScriptProperties().getProperty("numberOfSubscriptions"));
  sameNumberOfSubscriptions = (cachedNumberOfSubscriptions == numberOfSubscriptions);

  return sameNumberOfSubscriptions;
}

function getCachedUploadsPlaylistsForSubs()
{
  if (PropertiesService.getScriptProperties().getProperty("cachedUploadsPlaylists") == null)
    PropertiesService.getScriptProperties().setProperty("cachedUploadsPlaylists", "[]");

  return JSON.parse(PropertiesService.getScriptProperties().getProperty("cachedUploadsPlaylists"));
}

function checkIfVideoWasAddedRecently(videoId)
{
  if (PropertiesService.getScriptProperties().getProperty("cachedAddedVideos") == null)
    PropertiesService.getScriptProperties().setProperty("cachedAddedVideos", "[]");
  var recentlyAddedVideos = JSON.parse(PropertiesService.getScriptProperties().getProperty("cachedAddedVideos"));
  return (recentlyAddedVideos.includes(videoId));
}
function addVideoToAddedRecentlyList(videoId)
{
  if (PropertiesService.getScriptProperties().getProperty("cachedAddedVideos") == null)
    PropertiesService.getScriptProperties().setProperty("cachedAddedVideos", "[]");

  var recentlyAddedVideos = JSON.parse(PropertiesService.getScriptProperties().getProperty("cachedAddedVideos"));

  if (recentlyAddedVideos.length > numberOfRecentVideosToCache)
    recentlyAddedVideos.shift(); // remove oldest added item to save property space
  
  recentlyAddedVideos.push(videoId);

  PropertiesService.getScriptProperties().setProperty("cachedAddedVideos", JSON.stringify(recentlyAddedVideos));
}

//----

function getSubscriptions()
{
  let pageToken;
  var retList = [];

  var numberOfSubsSet = false;
  while(true)
  {
    try
    {
      const list = YouTube.Subscriptions.list(['snippet'],
      {
        "maxResults": 50,
        "mine": true,
        ...(pageToken && { pageToken })
      });

      if (!numberOfSubsSet)
      {
        var numberOfSubscriptions = list.pageInfo.totalResults;
        PropertiesService.getScriptProperties().setProperty("numberOfSubscriptions", numberOfSubscriptions);
        numberOfSubsSet = true;
      }

      const channelIds = Array.from(list.items, (element) => element.snippet.resourceId.channelId);

      retList = retList.concat(channelIds);

      if (!list.nextPageToken)
      {
        console.log("Subscription IDs");
        console.log(`${retList.join('\n')}`);
        return retList;
      }
      
      pageToken = list.nextPageToken;
    }
    catch (error)
    {
      console.warn(error);
    }
  }
}

function flattenAndConcatArraysWithOperation(array, operation)
{
  var retList = [];
  array.forEach(x => retList = retList.concat(operation(x)));
  return retList;
}

function distinctArray(array)
{
  return array.filter((value, index, arr) => arr.indexOf(value) === index);
}

function getUploadsPlaylist(channelId)
{
  let pageToken;
  var retList = [];
  while(true)
  {
    try
    {
      const list = YouTube.Channels.list(['contentDetails'],
      {
        "maxResults": 50,
        "id": channelId,
        ...(pageToken && { pageToken })
      });

      if (list.pageInfo.totalResults === 0)
      {
        console.log("No Upload Playlist found for subscription channel ID " + channelId);
      }
      else
      {
        const uploadsList = Array.from(list.items, (element) => element.contentDetails.relatedPlaylists.uploads);
        retList = retList.concat(uploadsList);
      }

      if (!list.nextPageToken)
      {
        console.log("Upload Playlist IDs for Subscriptions");
        console.log(`${retList.join('\n')}`);
        return retList;
      }
      
      pageToken = list.nextPageToken;
    }
    catch (error)
    {
      console.warn("Channel ID:" + channelId + "\nError:" + error);

      if (!pageToken)
      {
        return retList;
      }
    }
  }
}

function getVideosForPlaylist(playlistId)
{
  let pageToken;
  var retList = [];

  var eclipsedDateBoundary = false;

  while(!eclipsedDateBoundary)
  {
    try
    {
      const list = YouTube.PlaylistItems.list(['contentDetails'],
      {
        "maxResults": 50,
        "playlistId": playlistId,
        ...(pageToken && { pageToken })
      });

      var videosList = [];
      if (dateTimeToSearchBackForVideos === null)
      {
        // Get all videos
        videosList = Array.from(list.items, (element) => element.contentDetails.videoId);
      }
      else
      {
        // Only get videos after the "dateTimeToSearchBackForVideos" DateTime
        list.items.every(x =>
        {
          if (Date.parse(x.contentDetails.videoPublishedAt) < dateTimeToSearchBackForVideos)
          {
            // Since Upload lists are default sortedwith most recent first, if we encounter something that offends the date guard, we're done searching
            retList = retList.concat(videosList);

            eclipsedDateBoundary = true;

            console.log("Videos IDs");
            console.log(`${retList.join('\n')}`);
            return false;
          }
          videosList = videosList.concat([x.contentDetails.videoId]);
          return true;
        });
      }

      if (videosList.length > 0)
        retList = retList.concat(videosList);

      if (eclipsedDateBoundary || !list.nextPageToken)
      {
        console.log("Videos IDs");
        console.log(`${retList.join('\n')}`);
        return retList;
      }
      
      if (list.nextPageToken)
        pageToken = list.nextPageToken;
    }
    catch (error)
    {
      console.warn("Playlist ID:" + playlistId + "\nError:" + error);
      
      if (!pageToken)
      {
        return retList;
      }
    }
  }
}


function findPlaylist(compare)
{
  let pageToken;
  while(true)
  {
    const list = YouTube.Playlists.list(['snippet'],
    {
      "maxResults": 50,
      "mine": true,
      ...(pageToken && { pageToken })
    });
    
    const item = list.items.find((row) => compare && compare(row));
    if (item)
    {
      return item;
    }

    if (!list.nextPageToken)
    {
      return null;
    }

    pageToken = list.nextPageToken;
  }
}

function addPlaylist()
{
  const title = `wl__${(new Date().getMonth()) + 1}`;

  const item = findPlaylist(({ snippet }) => snippet.title === title);

  if (item)
  {
    return item;
  }

  return YouTube.Playlists.insert(
    {
      'snippet': {
        title,
      },
      'status': {
        'privacyStatus': 'private'
      }
    }, 
    'snippet,status'
  );
}

function insertVideo(playlistId, videoId, performCheckIfVideoWasAddedRecently = true) 
{
  var actuallyAddVideo = true;
  if (performCheckIfVideoWasAddedRecently)
  {
    if (checkIfVideoWasAddedRecently(videoId))
    {
      // If video was already recently added by this script, we don't need to add it again
      actuallyAddVideo = false;
      return false;
    }
  }

  if (actuallyAddVideo)
  {
    addVideoToAddedRecentlyList(videoId);

    return YouTube.PlaylistItems.insert(
      {
        "snippet": {
          playlistId,
          "position": 0,
          "resourceId": {
            "kind": "youtube#video",
            videoId
          }
        }
      },
      'snippet'
    );
  }
}

function run()
{
  setSearchBackDateTime();

  var uploadsPlaylists;

  if (!checkIfSubscriptionCountChanged())
  {
    const subscriptionIds = distinctArray(getSubscriptions());
    uploadsPlaylists = distinctArray(flattenAndConcatArraysWithOperation(subscriptionIds, getUploadsPlaylist));
    PropertiesService.getScriptProperties().setProperty("cachedUploadsPlaylists", JSON.stringify(uploadsPlaylists));
  }
  else
  {
    uploadsPlaylists = getCachedUploadsPlaylistsForSubs();
  }
  var videosIds = distinctArray(flattenAndConcatArraysWithOperation(uploadsPlaylists, getVideosForPlaylist));

  const watchList = addPlaylist();

  console.log("Videos to Add to WL (Playlist ID: " + watchList.id + ")");
  console.log(`${videosIds.join('\n')}`);

  videosIds.forEach(x => insertVideo(watchList.id, x));
}
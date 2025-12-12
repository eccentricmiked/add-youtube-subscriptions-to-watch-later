let sameNumberOfSubscriptions;
let dateTimeToSearchBackForVideos;
let numberOfRecentVideosToCache = 500;
//let title = `My_Watch_Later`;
let title = `My_Watch_Later10`;

//----

// ONLY HAVE ONE BLOCK UNCOMMENTED PER SCRIPT

// First Segment
//let startHourToAllowScriptExecution = 0;
//let endHourToAllowScriptExecution = 6;

// Second Segment
//let startHourToAllowScriptExecution = 6;
//let endHourToAllowScriptExecution = 12;

// Third Segment
//let startHourToAllowScriptExecution = 12;
//let endHourToAllowScriptExecution = 18;

// Fourth Segment
//let startHourToAllowScriptExecution = 18;
//let endHourToAllowScriptExecution = 24; // not a value hour but want to ensure that 11:xx pm is supported (23)

//----

let searchNumberOfMinutesBack = 30;

let videoAlreadyExistsInDesiredPlaylistMagicNumber = -999;

let quotaCount = 0;

let numberOfSubscriptionsProperty = 'numberOfSubscriptions';
let cachedUploadsPlaylistsProperty = 'cachedUploadsPlaylists';
let cachedAddedVideosProperty = 'cachedAddedVideos';

//----

function isScriptAllowedToExecuteNow()
{
  dateTimeForExecutionAssessment = new Date();

  if ((dateTimeForExecutionAssessment.getHours() >= startHourToAllowScriptExecution) && (dateTimeForExecutionAssessment.getHours() < endHourToAllowScriptExecution))
  {
    console.log("Allowed to execute this script since " + dateTimeForExecutionAssessment.toString() + " is between hours " + startHourToAllowScriptExecution + " and " + endHourToAllowScriptExecution + ".");
    return true;
  }

  console.warn("NOT allowed to execute this script since " + dateTimeForExecutionAssessment.toString() + " is not between hours " + startHourToAllowScriptExecution + " and " + endHourToAllowScriptExecution + ".");

  return false;
}

//----

function setSearchBackDateTime()
{
  dateTimeToSearchBackForVideos = new Date();
  dateTimeToSearchBackForVideos.setMinutes(dateTimeToSearchBackForVideos.getMinutes() - searchNumberOfMinutesBack);
}

function checkIfSubscriptionCountChanged()
{
  let pageToken;
  const list = YouTube.Subscriptions.list(['snippet'], {
    "maxResults": 50,
    "mine": true,
    ...(pageToken && { pageToken })
  });
  quotaCount = quotaCount + 1;
  console.log("Called YouTube.Subscriptions.list Endpoint. New Quota Count: " + quotaCount);

  var numberOfSubscriptions = parseInt(list.pageInfo.totalResults);
  
  if (PropertiesService.getScriptProperties().getProperty(numberOfSubscriptionsProperty) == null)
    PropertiesService.getScriptProperties().setProperty(numberOfSubscriptionsProperty, "0");

  cachedNumberOfSubscriptions = parseInt(PropertiesService.getScriptProperties().getProperty(numberOfSubscriptionsProperty));
  sameNumberOfSubscriptions = (cachedNumberOfSubscriptions == numberOfSubscriptions);

  return sameNumberOfSubscriptions;
}

function getCachedUploadsPlaylistsForSubs()
{
  if (PropertiesService.getScriptProperties().getProperty(cachedUploadsPlaylistsProperty) == null)
    PropertiesService.getScriptProperties().setProperty(cachedUploadsPlaylistsProperty, "[]");

  return JSON.parse(PropertiesService.getScriptProperties().getProperty(cachedUploadsPlaylistsProperty));
}

function checkIfVideoWasAddedRecently(videoId)
{
  if (PropertiesService.getScriptProperties().getProperty(cachedAddedVideosProperty) == null)
    PropertiesService.getScriptProperties().setProperty(cachedAddedVideosProperty, "[]");
  var recentlyAddedVideos = JSON.parse(PropertiesService.getScriptProperties().getProperty(cachedAddedVideosProperty));
  return (recentlyAddedVideos.includes(videoId));
}
function addVideoToAddedRecentlyList(videoId)
{
  if (PropertiesService.getScriptProperties().getProperty(cachedAddedVideosProperty) == null)
    PropertiesService.getScriptProperties().setProperty(cachedAddedVideosProperty, "[]");

  var recentlyAddedVideos = JSON.parse(PropertiesService.getScriptProperties().getProperty(cachedAddedVideosProperty));

  if (recentlyAddedVideos.length > numberOfRecentVideosToCache)
    recentlyAddedVideos.shift(); // remove oldest added item to save property space
  
  recentlyAddedVideos.push(videoId);

  PropertiesService.getScriptProperties().setProperty(cachedAddedVideosProperty, JSON.stringify(recentlyAddedVideos));
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
      quotaCount = quotaCount + 1;
      console.log("Called YouTube.Subscriptions.list Endpoint. New Quota Count: " + quotaCount);

      if (!numberOfSubsSet)
      {
        var numberOfSubscriptions = list.pageInfo.totalResults;
        PropertiesService.getScriptProperties().setProperty(numberOfSubscriptionsProperty, numberOfSubscriptions);
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
      quotaCount = quotaCount + 1;
      console.log("Called YouTube.Channels.list Endpoint. New Quota Count: " + quotaCount);

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

function getVideoDuration(videoId)
{
  let pageToken;
  while(true)
  {
    try
    {
      const list = YouTube.Videos.list(['contentDetails'],
      {
        "maxResults": 50,
        "id": videoId,
        ...(pageToken && { pageToken })
      });
      quotaCount = quotaCount + 1;
      console.log("Called YouTube.Videos.list Endpoint. New Quota Count: " + quotaCount);

      if (list.pageInfo.totalResults > 1)
      {
        console.warn("More than one video info found for id" + videoId + ". Size: " + list.pageInfo.totalResults);
        console.log("Returning the first video info found for id" + videoId + ". Size: " + list.items[0].contentDetails.duration);
        return list.items[0].contentDetails.duration;
      }
      else
      {
        if (list.pageInfo.totalResults == 0)
        {
          console.warn("No video info found for id: " + videoId + ". Size: " + list.pageInfo.totalResults);
          console.log("Inputting PT0S (zero seconds) for id: " + videoId + ".");
          return "PT0S";
        }

        return list.items[0].contentDetails.duration;
      }
    }
    catch (error)
    {
      console.warn("Video Id:" + videoId + "\nError:" + error);
      return null;
    }
  }
}

function parseIso8601Duration(durationString) {
  const regex = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?/;
  const matches = durationString.match(regex);

  if (!matches) {
    return null; // Invalid duration string
  }

  return {
    days: parseInt(matches[1] || 0),
    hours: parseInt(matches[2] || 0),
    minutes: parseInt(matches[3] || 0),
    seconds: parseFloat(matches[4] || 0),
  };
}
function compareDurations(durationA, durationB) {
  const parsedA = parseIso8601Duration(durationA);
  const parsedB = parseIso8601Duration(durationB);

  // Handle invalid durations
  if (!parsedA || !parsedB) {
    // Or throw an error, depending on your needs
    return 0; 
  }

  // Compare components from largest to smallest
  if (parsedA.days !== parsedB.days) return parsedA.days - parsedB.days;
  if (parsedA.hours !== parsedB.hours) return parsedA.hours - parsedB.hours;
  if (parsedA.minutes !== parsedB.minutes) return parsedA.minutes - parsedB.minutes;
  return parsedA.seconds - parsedB.seconds;
}

function getVideosForPlaylist(playlistId, searchVideosBasedOnTimeWindow = true)
{
  let pageToken;
  var retList = [];

  var eclipsedDateBoundary = false;

  while(!eclipsedDateBoundary)
  {
    try
    {
      const list = YouTube.PlaylistItems.list(['snippet, contentDetails'],
      {
        "maxResults": 50,
        "playlistId": playlistId,
        ...(pageToken && { pageToken })
      });
      quotaCount = quotaCount + 1;
      console.log("Called YouTube.PlaylistItems.list Endpoint. New Quota Count: " + quotaCount);

      var videosList = [];
      if (!searchVideosBasedOnTimeWindow) //|| dateTimeToSearchBackForVideos === null)
      {
        // Get all videos
        videosList = Array.from(list.items, (element) => [element.contentDetails.videoId, getVideoDuration(element.contentDetails.videoId)]);
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

            console.log("Videos IDs inside getVideosForPlaylist loop");
            console.log(`${retList.join('\n')}`);
            //return false;

            return retList;
          }
          var duration = getVideoDuration(x.contentDetails.videoId);

          // Add (videoId, duration) pair for later sort and strategic inserting
          videosList = videosList.concat([[x.contentDetails.videoId, duration]]);
          //return true;

          return videosList;
        });
      }

      if (videosList.length > 0)
        retList = retList.concat(videosList);

      if (eclipsedDateBoundary || !list.nextPageToken)
      {
        console.log("Videos IDs end of getVideosForPlaylist");
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
    quotaCount = quotaCount + 1;
    console.log("Called YouTube.Playlists.list Endpoint. New Quota Count: " + quotaCount);
    
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
  //const title = `wl__${(new Date().getMonth()) + 1}`;

  const item = findPlaylist(({ snippet }) => snippet.title === title);

  if (item)
  {
    console.log("Found existing Youtube Playlist " + title + " with ID: " + item.id);
    return item;
  }

  var insertResult = YouTube.Playlists.insert(
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
  quotaCount = quotaCount + 50;
  console.log("Called YouTube.Playlists.insert Endpoint. New Quota Count: " + quotaCount);

  return insertResult;
}

function getInsertPositionWithIncreasingDuration(playlistId, videoIdAndDuration)
{
  var videoDurationPairs = getVideosForPlaylist(playlistId, false);
  //var videoDurationPairs = getVideosForPlaylist(playlistId, true);

  var doesVideoAlreadyExistInList = (videoDurationPairs.findIndex(x => videoIdAndDuration[0] === x[0]) >= 0);

  if (doesVideoAlreadyExistInList) return videoAlreadyExistsInDesiredPlaylistMagicNumber;

  var insertionIndex = videoDurationPairs.findIndex(x => compareDurations(videoIdAndDuration[1], x[1]) <= 0);

  insertionIndex = (insertionIndex === -1) ? (videoDurationPairs.length) : insertionIndex;

  return insertionIndex;

  //let target = videoIdAndDuration[1];
  //let left = 0;
  //let right = videoDurationPairs.length - 1;
  //let insertionIndex = videoDurationPairs.length; // Default to end of array

  //while (left <= right) {
  //  const mid = Math.floor((left + right) / 2);

  //  if (videoDurationPairs[mid][1] === target) {
  //    return mid; // Target found, return its index
  //  } else if (videoDurationPairs[mid][1] < target) {
  //    left = mid + 1; // Target is in the right half
  //  } else {
  //    insertionIndex = mid; // Potential insertion point, target is in the left half
  //    right = mid - 1;
  //  }
  //}
  //return insertionIndex; // Return the determined insertion point
}

function insertVideo(playlistId, videoIdAndDuration, performCheckIfVideoWasAddedRecently = true, insertVideoBasedOnIncreasingDuration = true) 
{
  // videoIdAndDuration[0] = videoId; videoIdAndDuration[1] = duration
  var videoId = videoIdAndDuration[0];
  var videoDuration = videoIdAndDuration[1];

  var actuallyAddVideo = true;
  //if (performCheckIfVideoWasAddedRecently)
  //{
    //if (checkIfVideoWasAddedRecently(videoId))
    //{
      // If video was already recently added by this script, we don't need to add it again
      //actuallyAddVideo = false;
      //return false;
    //}
  //}

  if (actuallyAddVideo)
  {
    addVideoToAddedRecentlyList(videoId);

    var position = insertVideoBasedOnIncreasingDuration ? getInsertPositionWithIncreasingDuration(playlistId, videoIdAndDuration) : 0;

    if (position === videoAlreadyExistsInDesiredPlaylistMagicNumber) return null;

    var insertResult = YouTube.PlaylistItems.insert(
      {
        "snippet": {
          playlistId,
          "position": position,
          "resourceId": {
            "kind": "youtube#video",
            videoId
          }
        }
      },
      'snippet'
    );
    quotaCount = quotaCount + 50;
    console.log("Called YouTube.PlaylistItems.insert Endpoint. New Quota Count: " + quotaCount);

    return insertResult;
  }
}

function updatePlaylistDescription(playlistId)
{
  YouTube.Playlists.update(
    {
      'id': playlistId,
      'snippet': {
        'title': title,
        'description': 'Last Updated: ' + (new Date()).toString() +  '.'
        }
    },
    'id,snippet');

    quotaCount = quotaCount + 50;
    console.log("Called YouTube.Playlists.update Endpoint. New Quota Count: " + quotaCount);
}

function run()
{
  if (!isScriptAllowedToExecuteNow()) return;
  
  setSearchBackDateTime();
  var uploadsPlaylists;

  if (!checkIfSubscriptionCountChanged())
  {
    const subscriptionIds = distinctArray(getSubscriptions());
    uploadsPlaylists = distinctArray(flattenAndConcatArraysWithOperation(subscriptionIds, getUploadsPlaylist));
    PropertiesService.getScriptProperties().setProperty(cachedUploadsPlaylistsProperty, JSON.stringify(uploadsPlaylists));
  }
  else
  {
    uploadsPlaylists = getCachedUploadsPlaylistsForSubs();
  }

  var videosIdsAndDurations = distinctArray(flattenAndConcatArraysWithOperation(uploadsPlaylists, getVideosForPlaylist));

  videosIdsAndDurations.sort((a,b) => compareDurations(a[1], b[1]));

  const watchList = addPlaylist();

  console.log("Videos to Add to WL (Playlist ID: " + watchList.id + ")");
  console.log(`${videosIdsAndDurations.join('\n')}`);

  videosIdsAndDurations.forEach(x => insertVideo(watchList.id, x));

  updatePlaylistDescription(watchList.id);

  console.log("Total YouTube Quota Count Cost: " + quotaCount);
}
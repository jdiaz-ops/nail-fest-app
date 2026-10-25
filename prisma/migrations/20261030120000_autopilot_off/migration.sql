-- The YouTube autopilot switched off (2026-10-25, «apaga el piloto
-- automático»): with every video hidden it has nothing to do. Its settings,
-- the channel and every imported video stay as they were; the switch in
-- the admin's YouTube tab turns it back on once the videos come back.
UPDATE "LibrarySettings" SET "youtubeAutopilot" = false;

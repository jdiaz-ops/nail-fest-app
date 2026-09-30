-- Public-facing event name (see Event.publicName); NULL = use "name".
ALTER TABLE "Event" ADD COLUMN "publicName" TEXT;

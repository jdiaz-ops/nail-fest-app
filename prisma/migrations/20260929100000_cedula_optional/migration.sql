-- The ID number on the registration form becomes optional, with a label any
-- attendee recognizes (Venezuelans use a PPT or a "V-" cédula, not a NIT).
-- Only touches the row while it still has the old default label, so a label
-- the admin already customized is left alone; `required` is set either way.
UPDATE "CheckoutQuestion" SET "required" = false WHERE "key" = 'cedula';
UPDATE "CheckoutQuestion"
SET "label" = 'Documento de identidad (cédula, PPT o pasaporte)'
WHERE "key" = 'cedula' AND "label" = 'Número de cédula - o - NIT';

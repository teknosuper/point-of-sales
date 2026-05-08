INSERT INTO outlets (id, code, name, address, phone)
VALUES (
    'outlet-main',
    'MAIN',
    'POINZA Main Outlet',
    'Jl. Outlet Utama No. 1',
    '08123456789'
);

INSERT INTO kitchen_stations (id, outlet_id, slug, name, sort_order)
VALUES
    ('station-drinks', 'outlet-main', 'minuman', 'Dapur Minuman', 1),
    ('station-noodles', 'outlet-main', 'mie', 'Dapur Mie', 2),
    ('station-chicken', 'outlet-main', 'ayam', 'Dapur Ayam', 3),
    ('station-ramen', 'outlet-main', 'ramen', 'Dapur Ramen', 4),
    ('station-steak', 'outlet-main', 'steak', 'Dapur Steak', 5),
    ('station-durian-ice', 'outlet-main', 'es-duren', 'Dapur Es Duren', 6),
    ('station-satay', 'outlet-main', 'sate', 'Dapur Sate', 7),
    ('station-salad', 'outlet-main', 'salad', 'Dapur Salad', 8);

INSERT INTO kitchen_station_devices (id, outlet_id, station_id, device_type, device_name, target_ref)
VALUES
    ('device-drinks-screen-1', 'outlet-main', 'station-drinks', 'screen', 'Screen Minuman', 'kds://outlet-main/minuman/screen-1'),
    ('device-drinks-printer-1', 'outlet-main', 'station-drinks', 'printer', 'Printer Minuman', 'print://outlet-main/minuman/printer-1'),
    ('device-chicken-screen-1', 'outlet-main', 'station-chicken', 'screen', 'Screen Ayam', 'kds://outlet-main/ayam/screen-1'),
    ('device-chicken-printer-1', 'outlet-main', 'station-chicken', 'printer', 'Printer Ayam', 'print://outlet-main/ayam/printer-1'),
    ('device-salad-screen-1', 'outlet-main', 'station-salad', 'screen', 'Screen Salad', 'kds://outlet-main/salad/screen-1'),
    ('device-salad-printer-1', 'outlet-main', 'station-salad', 'printer', 'Printer Salad', 'print://outlet-main/salad/printer-1');

INSERT INTO products (id, sku, barcode, name, category_name, price_amount)
VALUES
    ('ayam-pedas', 'AYM-PDS', '111000001', 'Ayam Pedas', 'Ayam', 18000),
    ('ayam-bakar', 'AYM-BKR', '111000002', 'Ayam Bakar', 'Ayam', 20000),
    ('minuman-es', 'MNM-ES', '222000001', 'Minuman Es', 'Minuman', 8000),
    ('minuman-anget', 'MNM-ANG', '222000002', 'Minuman Anget', 'Minuman', 7000),
    ('salad', 'SLD-001', '333000001', 'Salad', 'Salad', 15000);

INSERT INTO product_station_mappings (id, product_id, outlet_id, station_id)
VALUES
    ('map-ayam-pedas', 'ayam-pedas', 'outlet-main', 'station-chicken'),
    ('map-ayam-bakar', 'ayam-bakar', 'outlet-main', 'station-chicken'),
    ('map-minuman-es', 'minuman-es', 'outlet-main', 'station-drinks'),
    ('map-minuman-anget', 'minuman-anget', 'outlet-main', 'station-drinks'),
    ('map-salad', 'salad', 'outlet-main', 'station-salad');

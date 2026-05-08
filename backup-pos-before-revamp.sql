/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: point_of_sales
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `event` varchar(255) NOT NULL,
  `module` varchar(255) NOT NULL,
  `auditable_type` varchar(255) DEFAULT NULL,
  `auditable_id` bigint(20) unsigned DEFAULT NULL,
  `target_label` varchar(255) DEFAULT NULL,
  `description` text NOT NULL,
  `before` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`before`)),
  `after` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`after`)),
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `audit_logs_user_id_foreign` (`user_id`),
  KEY `audit_logs_module_event_index` (`module`,`event`),
  KEY `audit_logs_auditable_type_auditable_id_index` (`auditable_type`,`auditable_id`),
  KEY `audit_logs_created_at_index` (`created_at`),
  CONSTRAINT `audit_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=42 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES
(1,NULL,'stock.adjusted','stock','App\\Models\\Product',1,'Aqua Botol 600ml','Stok produk bertambah dari restock retur penjualan.','{\"product_id\":1,\"stock_before\":197,\"stock_after\":197,\"difference\":0,\"reason\":\"Pelanggan menerima credit note untuk item yang tidak sesuai.\",\"reference\":\"SR-20260506104039-GA0R\"}','{\"product_id\":1,\"stock_before\":197,\"stock_after\":198,\"difference\":1,\"reason\":\"Pelanggan menerima credit note untuk item yang tidak sesuai.\",\"reference\":\"SR-20260506104039-GA0R\"}','{\"stock_mutation_id\":1,\"sales_return_id\":1,\"sales_return_code\":\"SR-20260506104039-GA0R\",\"mutation_type\":\"in\",\"qty\":1}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(2,NULL,'stock.adjusted','stock','App\\Models\\Product',3,'Kopi Susu Gula Aren','Stok produk bertambah dari restock retur penjualan.','{\"product_id\":3,\"stock_before\":78,\"stock_after\":78,\"difference\":0,\"reason\":\"Barang dikembalikan dan dana dikembalikan tunai.\",\"reference\":\"SR-20260506104039-UVU2\"}','{\"product_id\":3,\"stock_before\":78,\"stock_after\":79,\"difference\":1,\"reason\":\"Barang dikembalikan dan dana dikembalikan tunai.\",\"reference\":\"SR-20260506104039-UVU2\"}','{\"stock_mutation_id\":2,\"sales_return_id\":2,\"sales_return_code\":\"SR-20260506104039-UVU2\",\"mutation_type\":\"in\",\"qty\":1}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(3,1,'purchase_order.created','purchase','App\\Models\\PurchaseOrder',1,'PurchaseOrder #1','Purchase order PO-20260506-0001 dibuat.',NULL,'{\"document_number\":\"PO-20260506-0001\",\"supplier_id\":2,\"status\":\"draft\",\"total_items\":2}','{\"purchase_order_id\":1}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(4,1,'purchase_order.created','purchase','App\\Models\\PurchaseOrder',2,'PurchaseOrder #2','Purchase order PO-20260506-0002 dibuat.',NULL,'{\"document_number\":\"PO-20260506-0002\",\"supplier_id\":4,\"status\":\"draft\",\"total_items\":2}','{\"purchase_order_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(5,1,'purchase_order.ordered','purchase','App\\Models\\PurchaseOrder',2,'PurchaseOrder #2','Purchase order PO-20260506-0002 dipesan ke supplier.','{\"status\":\"draft\"}','{\"status\":\"ordered\"}','{\"purchase_order_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(6,1,'purchase_order.cancelled','purchase','App\\Models\\PurchaseOrder',2,'PurchaseOrder #2','Purchase order PO-20260506-0002 dibatalkan.','{\"status\":\"ordered\"}','{\"status\":\"cancelled\"}','{\"purchase_order_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(7,1,'purchase_order.created','purchase','App\\Models\\PurchaseOrder',3,'PurchaseOrder #3','Purchase order PO-20260506-0003 dibuat.',NULL,'{\"document_number\":\"PO-20260506-0003\",\"supplier_id\":1,\"status\":\"draft\",\"total_items\":2}','{\"purchase_order_id\":3}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(8,1,'purchase_order.ordered','purchase','App\\Models\\PurchaseOrder',3,'PurchaseOrder #3','Purchase order PO-20260506-0003 dipesan ke supplier.','{\"status\":\"draft\"}','{\"status\":\"ordered\"}','{\"purchase_order_id\":3}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(9,1,'stock.adjusted','stock','App\\Models\\Product',1,'Aqua Botol 600ml','Stok masuk dari penerimaan barang GR-20260506-0001','{\"product_id\":1,\"stock_before\":198,\"stock_after\":198,\"difference\":0,\"reference\":\"GR-20260506-0001\"}','{\"product_id\":1,\"stock_before\":198,\"stock_after\":228,\"difference\":30,\"reference\":\"GR-20260506-0001\"}','{\"stock_mutation_id\":3,\"goods_receiving_id\":1,\"document_number\":\"GR-20260506-0001\",\"mutation_type\":\"in\",\"qty\":30}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(10,1,'stock.adjusted','stock','App\\Models\\Product',5,'Chitato Original 68g','Stok masuk dari penerimaan barang GR-20260506-0001','{\"product_id\":5,\"stock_before\":118,\"stock_after\":118,\"difference\":0,\"reference\":\"GR-20260506-0001\"}','{\"product_id\":5,\"stock_before\":118,\"stock_after\":128,\"difference\":10,\"reference\":\"GR-20260506-0001\"}','{\"stock_mutation_id\":4,\"goods_receiving_id\":1,\"document_number\":\"GR-20260506-0001\",\"mutation_type\":\"in\",\"qty\":10}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(11,1,'payable.created_from_receiving','payable','App\\Models\\Payable',5,'Payable #5','Hutang otomatis dari penerimaan PO PO-20260506-0003',NULL,'{\"payable_id\":5,\"supplier_id\":1,\"total\":163000,\"document_number\":\"GR-20260506-0001\",\"purchase_order_id\":3}','{\"goods_receiving_id\":1}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(12,1,'goods_receiving.created','purchase','App\\Models\\GoodsReceiving',1,'GoodsReceiving #1','Barang diterima dari PO PO-20260506-0003',NULL,'{\"document_number\":\"GR-20260506-0001\",\"purchase_order_id\":3,\"total_items\":2}','{\"goods_receiving_id\":1}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(13,1,'purchase_order.created','purchase','App\\Models\\PurchaseOrder',4,'PurchaseOrder #4','Purchase order PO-20260506-0004 dibuat.',NULL,'{\"document_number\":\"PO-20260506-0004\",\"supplier_id\":3,\"status\":\"draft\",\"total_items\":3}','{\"purchase_order_id\":4}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(14,1,'purchase_order.ordered','purchase','App\\Models\\PurchaseOrder',4,'PurchaseOrder #4','Purchase order PO-20260506-0004 dipesan ke supplier.','{\"status\":\"draft\"}','{\"status\":\"ordered\"}','{\"purchase_order_id\":4}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(15,1,'stock.adjusted','stock','App\\Models\\Product',10,'Ayam Goreng Frozen','Stok masuk dari penerimaan barang GR-20260506-0002','{\"product_id\":10,\"stock_before\":33,\"stock_after\":33,\"difference\":0,\"reference\":\"GR-20260506-0002\"}','{\"product_id\":10,\"stock_before\":33,\"stock_after\":48,\"difference\":15,\"reference\":\"GR-20260506-0002\"}','{\"stock_mutation_id\":5,\"goods_receiving_id\":2,\"document_number\":\"GR-20260506-0002\",\"mutation_type\":\"in\",\"qty\":15}','127.0.0.1','Symfony','2026-05-06 03:40:39'),
(16,1,'stock.adjusted','stock','App\\Models\\Product',12,'Ultra Milk 1L','Stok masuk dari penerimaan barang GR-20260506-0002','{\"product_id\":12,\"stock_before\":78,\"stock_after\":78,\"difference\":0,\"reference\":\"GR-20260506-0002\"}','{\"product_id\":12,\"stock_before\":78,\"stock_after\":98,\"difference\":20,\"reference\":\"GR-20260506-0002\"}','{\"stock_mutation_id\":6,\"goods_receiving_id\":2,\"document_number\":\"GR-20260506-0002\",\"mutation_type\":\"in\",\"qty\":20}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(17,1,'stock.adjusted','stock','App\\Models\\Product',13,'Yogurt Cimory 250ml','Stok masuk dari penerimaan barang GR-20260506-0002','{\"product_id\":13,\"stock_before\":58,\"stock_after\":58,\"difference\":0,\"reference\":\"GR-20260506-0002\"}','{\"product_id\":13,\"stock_before\":58,\"stock_after\":74,\"difference\":16,\"reference\":\"GR-20260506-0002\"}','{\"stock_mutation_id\":7,\"goods_receiving_id\":2,\"document_number\":\"GR-20260506-0002\",\"mutation_type\":\"in\",\"qty\":16}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(18,1,'payable.created_from_receiving','payable','App\\Models\\Payable',6,'Payable #6','Hutang otomatis dari penerimaan PO PO-20260506-0004',NULL,'{\"payable_id\":6,\"supplier_id\":3,\"total\":803600,\"document_number\":\"GR-20260506-0002\",\"purchase_order_id\":4}','{\"goods_receiving_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(19,1,'goods_receiving.created','purchase','App\\Models\\GoodsReceiving',2,'GoodsReceiving #2','Barang diterima dari PO PO-20260506-0004',NULL,'{\"document_number\":\"GR-20260506-0002\",\"purchase_order_id\":4,\"total_items\":3}','{\"goods_receiving_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(20,1,'supplier_return.created','purchase','App\\Models\\SupplierReturn',1,'SupplierReturn #1','Supplier return SR-20260506-0001 dibuat.',NULL,'{\"document_number\":\"SR-20260506-0001\",\"supplier_id\":3,\"status\":\"draft\",\"total_items\":1}','{\"supplier_return_id\":1}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(21,1,'supplier_return.created','purchase','App\\Models\\SupplierReturn',2,'SupplierReturn #2','Supplier return SR-20260506-0002 dibuat.',NULL,'{\"document_number\":\"SR-20260506-0002\",\"supplier_id\":3,\"status\":\"draft\",\"total_items\":1}','{\"supplier_return_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(22,1,'stock.adjusted','stock','App\\Models\\Product',10,'Ayam Goreng Frozen','Stok keluar dari retur supplier SR-20260506-0002','{\"product_id\":10,\"stock_before\":48,\"stock_after\":48,\"difference\":0,\"reference\":\"SR-20260506-0002\"}','{\"product_id\":10,\"stock_before\":48,\"stock_after\":46,\"difference\":-2,\"reference\":\"SR-20260506-0002\"}','{\"stock_mutation_id\":8,\"supplier_return_id\":2,\"document_number\":\"SR-20260506-0002\",\"mutation_type\":\"out\",\"qty\":2}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(23,1,'supplier_return.completed','purchase','App\\Models\\SupplierReturn',2,'SupplierReturn #2','Supplier return SR-20260506-0002 diselesaikan. Stok dikurangi dan hutang dikoreksi.',NULL,'{\"status\":\"completed\"}','{\"supplier_return_id\":2}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(24,1,'stock.adjusted','stock','App\\Models\\Product',10,'Ayam Goreng Frozen','Stok produk disesuaikan melalui stock opname.','{\"product_id\":10,\"stock_before\":46,\"stock_after\":46,\"difference\":0,\"reason\":\"Satu pcs rusak saat bongkar muat.\",\"reference\":\"SO-FINAL-001\"}','{\"product_id\":10,\"stock_before\":46,\"stock_after\":32,\"difference\":-14,\"reason\":\"Satu pcs rusak saat bongkar muat.\",\"reference\":\"SO-FINAL-001\"}','{\"stock_mutation_id\":9,\"stock_opname_id\":2,\"stock_opname_code\":\"SO-FINAL-001\",\"mutation_type\":\"adjustment\",\"qty\":14}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(25,1,'stock.adjusted','stock','App\\Models\\Product',12,'Ultra Milk 1L','Stok produk disesuaikan melalui stock opname.','{\"product_id\":12,\"stock_before\":98,\"stock_after\":98,\"difference\":0,\"reason\":\"Temuan stok terselip di rak pendingin.\",\"reference\":\"SO-FINAL-001\"}','{\"product_id\":12,\"stock_before\":98,\"stock_after\":80,\"difference\":-18,\"reason\":\"Temuan stok terselip di rak pendingin.\",\"reference\":\"SO-FINAL-001\"}','{\"stock_mutation_id\":10,\"stock_opname_id\":2,\"stock_opname_code\":\"SO-FINAL-001\",\"mutation_type\":\"adjustment\",\"qty\":18}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(26,1,'stock.adjusted','stock','App\\Models\\Product',13,'Yogurt Cimory 250ml','Stok produk disesuaikan melalui stock opname.','{\"product_id\":13,\"stock_before\":74,\"stock_after\":74,\"difference\":0,\"reason\":null,\"reference\":\"SO-FINAL-001\"}','{\"product_id\":13,\"stock_before\":74,\"stock_after\":58,\"difference\":-16,\"reason\":\"Adjustment dari stock opname.\",\"reference\":\"SO-FINAL-001\"}','{\"stock_mutation_id\":11,\"stock_opname_id\":2,\"stock_opname_code\":\"SO-FINAL-001\",\"mutation_type\":\"adjustment\",\"qty\":16}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(27,1,'stock.opname.finalized','stock','App\\Models\\StockOpname',2,'SO-FINAL-001','Stock opname difinalisasi.','{\"status\":\"draft\"}','{\"status\":\"finalized\"}','{\"code\":\"SO-FINAL-001\",\"notes\":\"Opname gudang pendingin untuk batch awal pekan.\",\"items\":[{\"product_id\":10,\"product_title\":\"Ayam Goreng Frozen\",\"stock_before\":33,\"stock_after\":32,\"difference\":-1,\"reason\":\"Satu pcs rusak saat bongkar muat.\",\"reference\":\"SO-FINAL-001\"},{\"product_id\":12,\"product_title\":\"Ultra Milk 1L\",\"stock_before\":78,\"stock_after\":80,\"difference\":2,\"reason\":\"Temuan stok terselip di rak pendingin.\",\"reference\":\"SO-FINAL-001\"},{\"product_id\":13,\"product_title\":\"Yogurt Cimory 250ml\",\"stock_before\":58,\"stock_after\":58,\"difference\":0,\"reason\":null,\"reference\":\"SO-FINAL-001\"}]}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(28,1,'store.setting.updated','store_settings',NULL,NULL,'Store Profile','Profil toko diperbarui.','{\"store_name\":\"Toko Anda\",\"store_address\":\"Alamat belum diisi\",\"store_phone\":\"\",\"store_email\":\"\",\"store_website\":\"\",\"store_city\":\"\",\"store_logo_changed\":false}','{\"store_name\":\"Toko Maju Bersama\",\"store_address\":\"Jl. Sukajadi No. 88, Bandung\",\"store_phone\":\"022-6012345\",\"store_email\":\"halo@majubersama.test\",\"store_website\":\"https:\\/\\/majubersama.test\",\"store_city\":\"Bandung\",\"store_logo_changed\":false}',NULL,'127.0.0.1','Symfony','2026-05-06 03:40:40'),
(29,1,'bank_account.created','bank_accounts','App\\Models\\BankAccount',1,'BankAccount #1','Rekening bank ditambahkan.',NULL,'{\"bank_name\":\"BCA\",\"account_number_masked\":\"******8776\",\"account_name\":\"PT Maju Bersama Retail\",\"is_active\":true,\"sort_order\":0}',NULL,'127.0.0.1','Symfony','2026-05-06 03:40:40'),
(30,1,'bank_account.created','bank_accounts','App\\Models\\BankAccount',2,'BankAccount #2','Rekening bank ditambahkan.',NULL,'{\"bank_name\":\"Mandiri\",\"account_number_masked\":\"*********5678\",\"account_name\":\"PT Maju Bersama Retail\",\"is_active\":true,\"sort_order\":1}',NULL,'127.0.0.1','Symfony','2026-05-06 03:40:40'),
(31,1,'bank_account.created','bank_accounts','App\\Models\\BankAccount',3,'BankAccount #3','Rekening bank ditambahkan.',NULL,'{\"bank_name\":\"BRI\",\"account_number_masked\":\"***********7503\",\"account_name\":\"PT Maju Bersama Retail\",\"is_active\":false,\"sort_order\":2}',NULL,'127.0.0.1','Symfony','2026-05-06 03:40:40'),
(32,1,'bank_account.reordered','bank_accounts',NULL,NULL,'Bank Accounts','Urutan rekening bank diperbarui.','{\"order\":[{\"bank_name\":\"Mandiri\",\"sort_order\":0},{\"bank_name\":\"BCA\",\"sort_order\":1},{\"bank_name\":\"BRI\",\"sort_order\":2}]}','{\"order\":[{\"bank_name\":\"BCA\",\"sort_order\":0},{\"bank_name\":\"Mandiri\",\"sort_order\":1},{\"bank_name\":\"BRI\",\"sort_order\":2}]}',NULL,'127.0.0.1','Symfony','2026-05-06 03:40:40'),
(33,1,'payment.setting.updated','payment_settings','App\\Models\\PaymentSetting',1,'PaymentSetting #1','Konfigurasi payment gateway diperbarui.','{\"default_gateway\":\"cash\",\"bank_transfer_enabled\":false,\"midtrans_enabled\":false,\"midtrans_production\":false,\"xendit_enabled\":false,\"xendit_production\":false}','{\"default_gateway\":\"cash\",\"bank_transfer_enabled\":true,\"midtrans_enabled\":false,\"midtrans_production\":false,\"xendit_enabled\":false,\"xendit_production\":false}',NULL,'127.0.0.1','Symfony','2026-05-06 03:40:40'),
(34,1,'cashier.shift.reviewed','cashier_shifts',NULL,NULL,'Shift Kasir Aktif','Supervisor meninjau ringkasan shift kasir aktif.',NULL,NULL,'{\"reviewed_by\":\"Arya Dwi Putra\",\"cashier\":\"Cashier\",\"reviewed_at\":\"2026-05-06T09:40:40+00:00\"}','127.0.0.1','Symfony','2026-05-06 03:40:40'),
(35,1,'auth.login_succeeded','auth','App\\Models\\User',1,'Arya Dwi Putra','Login berhasil.',NULL,NULL,'{\"severity\":\"info\",\"route\":null,\"remember\":true}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 03:43:18'),
(36,1,'auth.logout','auth','App\\Models\\User',1,'Arya Dwi Putra','Logout berhasil.',NULL,NULL,'{\"severity\":\"info\",\"route\":\"logout\"}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 03:53:38'),
(37,1,'auth.login_succeeded','auth','App\\Models\\User',1,'Arya Dwi Putra','Login berhasil.',NULL,NULL,'{\"severity\":\"info\",\"route\":null,\"remember\":false}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 17:26:53'),
(38,1,'cashier_shift.opened','cashier_shifts','App\\Models\\CashierShift',4,'CashierShift #4','Shift kasir dibuka.',NULL,'{\"status\":\"open\",\"opening_cash\":100000,\"expected_cash\":100000,\"actual_cash\":null,\"cash_difference\":null,\"transactions_count\":0,\"sales_returns_count\":0}','{\"cashier_id\":1,\"opened_by\":1}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 17:34:57'),
(39,1,'auth.login_succeeded','auth','App\\Models\\User',1,'Athikur Rakhman','Login berhasil.',NULL,NULL,'{\"severity\":\"info\",\"route\":null,\"remember\":false}','127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 21:09:39'),
(40,1,'store.setting.updated','store_settings',NULL,NULL,'Store Profile','Profil toko diperbarui.','{\"store_name\":\"Toko Maju Bersama\",\"store_address\":\"Jl. Sukajadi No. 88, Bandung\",\"store_phone\":\"022-6012345\",\"store_email\":\"halo@majubersama.test\",\"store_website\":\"https:\\/\\/majubersama.test\",\"store_city\":\"Bandung\",\"store_logo_changed\":false}','{\"store_name\":\"TOKO KITA\",\"store_address\":\"Magelang\",\"store_phone\":\"085868464443\",\"store_email\":\"halo@poinza.store\",\"store_website\":\"https:\\/\\/poinza.store\",\"store_city\":\"magelang\",\"store_logo_changed\":false}',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 21:12:39'),
(41,1,'store.setting.updated','store_settings',NULL,NULL,'Store Profile','Profil toko diperbarui.','{\"store_name\":\"TOKO KITA\",\"store_address\":\"Magelang\",\"store_phone\":\"085868464443\",\"store_email\":\"halo@poinza.store\",\"store_website\":\"https:\\/\\/poinza.store\",\"store_city\":\"magelang\",\"store_logo_changed\":false}','{\"store_name\":\"POINZA STORE\",\"store_address\":\"Magelang\",\"store_phone\":\"085868464443\",\"store_email\":\"halo@poinza.store\",\"store_website\":\"https:\\/\\/poinza.store\",\"store_city\":\"magelang\",\"store_logo_changed\":false}',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','2026-05-06 21:12:45');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bank_accounts`
--

DROP TABLE IF EXISTS `bank_accounts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `bank_accounts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `bank_name` varchar(255) NOT NULL,
  `account_number` varchar(255) NOT NULL,
  `account_name` varchar(255) NOT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bank_accounts`
--

LOCK TABLES `bank_accounts` WRITE;
/*!40000 ALTER TABLE `bank_accounts` DISABLE KEYS */;
INSERT INTO `bank_accounts` VALUES
(1,'BCA','0149988776','PT Maju Bersama Retail',NULL,1,0,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,'Mandiri','1370012345678','PT Maju Bersama Retail',NULL,1,1,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,'BRI','002401998877503','PT Maju Bersama Retail',NULL,0,2,'2026-05-06 03:40:39','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `bank_accounts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache`
--

DROP TABLE IF EXISTS `cache`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache`
--

LOCK TABLES `cache` WRITE;
/*!40000 ALTER TABLE `cache` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cache_locks`
--

DROP TABLE IF EXISTS `cache_locks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cache_locks`
--

LOCK TABLES `cache_locks` WRITE;
/*!40000 ALTER TABLE `cache_locks` DISABLE KEYS */;
/*!40000 ALTER TABLE `cache_locks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `carts`
--

DROP TABLE IF EXISTS `carts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `carts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cashier_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `qty` int(11) NOT NULL,
  `price` bigint(20) NOT NULL,
  `hold_id` varchar(255) DEFAULT NULL,
  `hold_label` varchar(255) DEFAULT NULL,
  `held_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `carts_product_id_foreign` (`product_id`),
  KEY `carts_hold_id_index` (`hold_id`),
  KEY `carts_cashier_id_hold_id_index` (`cashier_id`,`hold_id`),
  CONSTRAINT `carts_cashier_id_foreign` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`),
  CONSTRAINT `carts_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carts`
--

LOCK TABLES `carts` WRITE;
/*!40000 ALTER TABLE `carts` DISABLE KEYS */;
/*!40000 ALTER TABLE `carts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cashier_shifts`
--

DROP TABLE IF EXISTS `cashier_shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cashier_shifts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `opened_by` bigint(20) unsigned NOT NULL,
  `closed_by` bigint(20) unsigned DEFAULT NULL,
  `opened_at` timestamp NOT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `opening_cash` bigint(20) unsigned NOT NULL DEFAULT 0,
  `expected_cash` bigint(20) unsigned NOT NULL DEFAULT 0,
  `actual_cash` bigint(20) unsigned DEFAULT NULL,
  `cash_sales_total` bigint(20) unsigned NOT NULL DEFAULT 0,
  `non_cash_sales_total` bigint(20) unsigned NOT NULL DEFAULT 0,
  `cash_refund_total` bigint(20) unsigned NOT NULL DEFAULT 0,
  `non_cash_refund_total` bigint(20) unsigned NOT NULL DEFAULT 0,
  `transactions_count` int(10) unsigned NOT NULL DEFAULT 0,
  `sales_returns_count` int(10) unsigned NOT NULL DEFAULT 0,
  `cash_difference` bigint(20) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `close_notes` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cashier_shifts_opened_by_foreign` (`opened_by`),
  KEY `cashier_shifts_closed_by_foreign` (`closed_by`),
  KEY `cashier_shifts_user_id_status_index` (`user_id`,`status`),
  KEY `cashier_shifts_status_opened_at_index` (`status`,`opened_at`),
  CONSTRAINT `cashier_shifts_closed_by_foreign` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cashier_shifts_opened_by_foreign` FOREIGN KEY (`opened_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `cashier_shifts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cashier_shifts`
--

LOCK TABLES `cashier_shifts` WRITE;
/*!40000 ALTER TABLE `cashier_shifts` DISABLE KEYS */;
INSERT INTO `cashier_shifts` VALUES
(1,2,1,2,'2026-05-04 01:00:00','2026-05-04 08:30:00',175000,175000,170000,0,129000,0,5000,2,1,-5000,'Shift pagi weekday untuk sample histori.','Closing normal dengan selisih kurang kecil.','closed','2026-05-04 01:00:00','2026-05-04 08:30:00'),
(2,2,2,1,'2026-05-05 02:00:00','2026-05-05 10:15:00',200000,277500,284500,77500,148000,0,0,2,0,7000,'Shift sore yang nanti ditutup supervisor.','Supervisor menutup shift terlambat dengan selisih lebih.','force_closed','2026-05-05 02:00:00','2026-05-05 10:15:00'),
(3,2,2,NULL,'2026-05-06 01:00:00',NULL,250000,250000,NULL,0,0,0,0,0,0,NULL,'Shift aktif hari ini.',NULL,'open','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(4,1,1,NULL,'2026-05-06 17:34:57',NULL,100000,100000,NULL,0,0,0,0,0,0,NULL,'testing',NULL,'open','2026-05-06 17:34:57','2026-05-06 17:34:57');
/*!40000 ALTER TABLE `cashier_shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `image` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `categories`
--

LOCK TABLES `categories` WRITE;
/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` VALUES
(1,'cat-minuman.jpg','Minuman','Aneka minuman segar dan kemasan','2026-05-06 03:40:10','2026-05-06 03:40:10'),
(2,'cat-makanan-ringan.jpg','Makanan Ringan','Camilan dan snack kemasan','2026-05-06 03:40:10','2026-05-06 03:40:10'),
(3,'cat-makanan-berat.jpg','Makanan Berat','Makanan siap saji dan frozen food','2026-05-06 03:40:11','2026-05-06 03:40:11'),
(4,'cat-produk-susu.jpg','Produk Susu','Susu, yogurt, dan produk olahan susu','2026-05-06 03:40:12','2026-05-06 03:40:12'),
(5,'cat-roti-kue.jpg','Roti & Kue','Roti segar dan aneka kue','2026-05-06 03:40:13','2026-05-06 03:40:13'),
(6,'cat-bumbu-rempah.jpg','Bumbu & Rempah','Bumbu masak dan rempah-rempah','2026-05-06 03:40:14','2026-05-06 03:40:14'),
(7,'cat-perawatan-tubuh.jpg','Perawatan Tubuh','Sabun, shampoo, dan perawatan diri','2026-05-06 03:40:15','2026-05-06 03:40:15'),
(8,'cat-kebutuhan-rumah.jpg','Kebutuhan Rumah','Perlengkapan rumah tangga','2026-05-06 03:40:16','2026-05-06 03:40:16');
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_campaign_logs`
--

DROP TABLE IF EXISTS `customer_campaign_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_campaign_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_campaign_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `transaction_id` bigint(20) unsigned DEFAULT NULL,
  `receivable_id` bigint(20) unsigned DEFAULT NULL,
  `channel` varchar(20) NOT NULL DEFAULT 'internal',
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_campaign_logs_transaction_id_foreign` (`transaction_id`),
  KEY `customer_campaign_logs_receivable_id_foreign` (`receivable_id`),
  KEY `customer_campaign_logs_customer_campaign_id_status_index` (`customer_campaign_id`,`status`),
  KEY `customer_campaign_logs_customer_id_status_index` (`customer_id`,`status`),
  CONSTRAINT `customer_campaign_logs_customer_campaign_id_foreign` FOREIGN KEY (`customer_campaign_id`) REFERENCES `customer_campaigns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_campaign_logs_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customer_campaign_logs_receivable_id_foreign` FOREIGN KEY (`receivable_id`) REFERENCES `receivables` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customer_campaign_logs_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_campaign_logs`
--

LOCK TABLES `customer_campaign_logs` WRITE;
/*!40000 ALTER TABLE `customer_campaign_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_campaign_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_campaigns`
--

DROP TABLE IF EXISTS `customer_campaigns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_campaigns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `type` varchar(40) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `channel` varchar(20) NOT NULL DEFAULT 'internal',
  `context_key` varchar(255) DEFAULT NULL,
  `audience_filters` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`audience_filters`)),
  `audience_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`audience_snapshot`)),
  `message_template` text DEFAULT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_campaigns_context_key_unique` (`context_key`),
  KEY `customer_campaigns_created_by_foreign` (`created_by`),
  KEY `customer_campaigns_type_status_index` (`type`,`status`),
  CONSTRAINT `customer_campaigns_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_campaigns`
--

LOCK TABLES `customer_campaigns` WRITE;
/*!40000 ALTER TABLE `customer_campaigns` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_campaigns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_credits`
--

DROP TABLE IF EXISTS `customer_credits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_credits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `sales_return_id` bigint(20) unsigned NOT NULL,
  `amount` bigint(20) NOT NULL,
  `balance` bigint(20) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_credits_customer_id_foreign` (`customer_id`),
  KEY `customer_credits_sales_return_id_foreign` (`sales_return_id`),
  CONSTRAINT `customer_credits_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_credits_sales_return_id_foreign` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_credits`
--

LOCK TABLES `customer_credits` WRITE;
/*!40000 ALTER TABLE `customer_credits` DISABLE KEYS */;
INSERT INTO `customer_credits` VALUES
(1,1,1,5000,5000,'Saldo toko sample dari retur SR-20260506104039-GA0R','2026-05-04 04:00:00','2026-05-04 04:00:00');
/*!40000 ALTER TABLE `customer_credits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_segment_memberships`
--

DROP TABLE IF EXISTS `customer_segment_memberships`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_segment_memberships` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `customer_segment_id` bigint(20) unsigned NOT NULL,
  `source` varchar(20) NOT NULL,
  `matched_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `cust_seg_membership_unique` (`customer_id`,`customer_segment_id`),
  KEY `cust_seg_membership_source_idx` (`customer_segment_id`,`source`),
  CONSTRAINT `customer_segment_memberships_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_segment_memberships_customer_segment_id_foreign` FOREIGN KEY (`customer_segment_id`) REFERENCES `customer_segments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_segment_memberships`
--

LOCK TABLES `customer_segment_memberships` WRITE;
/*!40000 ALTER TABLE `customer_segment_memberships` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_segment_memberships` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_segments`
--

DROP TABLE IF EXISTS `customer_segments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_segments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `type` varchar(20) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `description` text DEFAULT NULL,
  `auto_rule_type` varchar(40) DEFAULT NULL,
  `rule_config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`rule_config`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_segments_slug_unique` (`slug`),
  KEY `customer_segments_type_is_active_index` (`type`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_segments`
--

LOCK TABLES `customer_segments` WRITE;
/*!40000 ALTER TABLE `customer_segments` DISABLE KEYS */;
/*!40000 ALTER TABLE `customer_segments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customer_vouchers`
--

DROP TABLE IF EXISTS `customer_vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customer_vouchers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `discount_type` varchar(20) NOT NULL DEFAULT 'fixed_amount',
  `discount_value` decimal(15,2) NOT NULL,
  `minimum_order` bigint(20) unsigned NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_used` tinyint(1) NOT NULL DEFAULT 0,
  `starts_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `used_at` timestamp NULL DEFAULT NULL,
  `used_transaction_id` bigint(20) unsigned DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customer_vouchers_code_unique` (`code`),
  KEY `customer_vouchers_used_transaction_id_foreign` (`used_transaction_id`),
  KEY `customer_vouchers_created_by_foreign` (`created_by`),
  KEY `customer_vouchers_customer_id_is_active_is_used_index` (`customer_id`,`is_active`,`is_used`),
  KEY `customer_vouchers_code_is_active_index` (`code`,`is_active`),
  CONSTRAINT `customer_vouchers_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `customer_vouchers_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_vouchers_used_transaction_id_foreign` FOREIGN KEY (`used_transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customer_vouchers`
--

LOCK TABLES `customer_vouchers` WRITE;
/*!40000 ALTER TABLE `customer_vouchers` DISABLE KEYS */;
INSERT INTO `customer_vouchers` VALUES
(1,1,'VCR-ANDI10','Voucher Loyal Gold','fixed_amount',10000.00,75000,1,0,'2026-04-29 03:40:39','2026-06-05 03:40:39',NULL,NULL,NULL,NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,2,'VCR-BUNGA5','Voucher Repeat Order','percentage',5.00,50000,1,0,'2026-04-29 03:40:39','2026-06-05 03:40:39',NULL,NULL,NULL,NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,5,'VCR-EKO25','Voucher Platinum','fixed_amount',25000.00,150000,1,0,'2026-04-29 03:40:39','2026-06-05 03:40:39',NULL,NULL,NULL,NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `customer_vouchers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `customers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `no_telp` bigint(20) NOT NULL,
  `address` text NOT NULL,
  `is_loyalty_member` tinyint(1) NOT NULL DEFAULT 0,
  `member_code` varchar(255) DEFAULT NULL,
  `loyalty_tier` varchar(30) NOT NULL DEFAULT 'regular',
  `loyalty_points` int(10) unsigned NOT NULL DEFAULT 0,
  `loyalty_total_spent` bigint(20) unsigned NOT NULL DEFAULT 0,
  `loyalty_transaction_count` int(10) unsigned NOT NULL DEFAULT 0,
  `loyalty_member_since` timestamp NULL DEFAULT NULL,
  `last_purchase_at` timestamp NULL DEFAULT NULL,
  `province_id` varchar(10) DEFAULT NULL,
  `province_name` varchar(255) DEFAULT NULL,
  `regency_id` varchar(10) DEFAULT NULL,
  `regency_name` varchar(255) DEFAULT NULL,
  `district_id` varchar(10) DEFAULT NULL,
  `district_name` varchar(255) DEFAULT NULL,
  `village_id` varchar(10) DEFAULT NULL,
  `village_name` varchar(255) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `customers_member_code_unique` (`member_code`),
  KEY `customers_is_loyalty_member_loyalty_tier_index` (`is_loyalty_member`,`loyalty_tier`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `customers`
--

LOCK TABLES `customers` WRITE;
/*!40000 ALTER TABLE `customers` DISABLE KEYS */;
INSERT INTO `customers` VALUES
(1,'Andi Nugraha',6281211111111,'Jl. Melati No. 21, Bandung',1,'MEM-ANDI001','gold',180,1800000,12,'2025-09-06 03:40:09',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(2,'Bunga Maharani',6281312345678,'Jl. Mawar No. 5, Jakarta',1,'MEM-BUNGA01','silver',60,780000,6,'2026-01-06 03:40:09',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(3,'Cici Amelia',6281512340000,'Jl. Anggrek No. 17, Surabaya',0,NULL,'regular',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(4,'Davin Pradipta',6285612349911,'Jl. Kenanga No. 2, Yogyakarta',0,NULL,'regular',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(5,'Eko Saputra',6287712348822,'Jl. Cemara No. 45, Semarang',1,'MEM-EKO0001','platinum',420,3600000,21,'2025-05-06 03:40:09',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(6,'Fitri Lestari',6282213345566,'Jl. Sakura No. 7, Medan',0,NULL,'regular',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(7,'Gina Putri',6281399887766,'Jl. Dahlia No. 12, Malang',0,NULL,'regular',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(8,'Hendra Wijaya',6285544332211,'Jl. Flamboyan No. 8, Denpasar',0,NULL,'regular',0,0,0,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:40:09','2026-05-06 03:40:09'),
(9,'NON MEMBER',0,'NON MEMBER ALAMAT',0,NULL,'regular',0,23000,1,NULL,'2026-05-06 21:10:43',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2026-05-06 21:10:05','2026-05-06 21:10:43');
/*!40000 ALTER TABLE `customers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `failed_jobs`
--

DROP TABLE IF EXISTS `failed_jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `failed_jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `failed_jobs`
--

LOCK TABLES `failed_jobs` WRITE;
/*!40000 ALTER TABLE `failed_jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `failed_jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receiving_items`
--

DROP TABLE IF EXISTS `goods_receiving_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receiving_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `goods_receiving_id` bigint(20) unsigned NOT NULL,
  `purchase_order_item_id` bigint(20) unsigned DEFAULT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `qty_received` int(11) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `goods_receiving_items_goods_receiving_id_foreign` (`goods_receiving_id`),
  KEY `goods_receiving_items_purchase_order_item_id_foreign` (`purchase_order_item_id`),
  KEY `goods_receiving_items_product_id_foreign` (`product_id`),
  CONSTRAINT `goods_receiving_items_goods_receiving_id_foreign` FOREIGN KEY (`goods_receiving_id`) REFERENCES `goods_receivings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `goods_receiving_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `goods_receiving_items_purchase_order_item_id_foreign` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receiving_items`
--

LOCK TABLES `goods_receiving_items` WRITE;
/*!40000 ALTER TABLE `goods_receiving_items` DISABLE KEYS */;
INSERT INTO `goods_receiving_items` VALUES
(1,1,5,1,30,'Sebagian aqua diterima lebih awal.','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,1,6,5,10,'Sebagian snack diterima sesuai surat jalan pertama.','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,2,7,10,15,'Diterima penuh dari supplier.','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(4,2,8,12,20,'Diterima penuh dari supplier.','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(5,2,9,13,16,'Diterima penuh dari supplier.','2026-05-06 03:40:40','2026-05-06 03:40:40');
/*!40000 ALTER TABLE `goods_receiving_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `goods_receivings`
--

DROP TABLE IF EXISTS `goods_receivings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `goods_receivings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint(20) unsigned NOT NULL,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `document_number` varchar(255) NOT NULL,
  `notes` text DEFAULT NULL,
  `received_by` bigint(20) unsigned DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `goods_receivings_document_number_unique` (`document_number`),
  KEY `goods_receivings_purchase_order_id_foreign` (`purchase_order_id`),
  KEY `goods_receivings_supplier_id_foreign` (`supplier_id`),
  KEY `goods_receivings_received_by_foreign` (`received_by`),
  CONSTRAINT `goods_receivings_purchase_order_id_foreign` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `goods_receivings_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `goods_receivings_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `goods_receivings`
--

LOCK TABLES `goods_receivings` WRITE;
/*!40000 ALTER TABLE `goods_receivings` DISABLE KEYS */;
INSERT INTO `goods_receivings` VALUES
(1,3,1,'GR-20260506-0001','Penerimaan pertama untuk PO restock mingguan.',2,'2026-05-04 03:15:00','2026-05-04 03:15:00','2026-05-04 03:15:00'),
(2,4,3,'GR-20260506-0002','Seluruh item diterima lengkap dan langsung masuk gudang.',2,'2026-05-05 04:10:00','2026-05-05 04:10:00','2026-05-05 04:10:00');
/*!40000 ALTER TABLE `goods_receivings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `indonesia_cities`
--

DROP TABLE IF EXISTS `indonesia_cities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `indonesia_cities` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(4) NOT NULL,
  `province_code` char(2) NOT NULL,
  `name` varchar(255) NOT NULL,
  `meta` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `indonesia_cities_code_unique` (`code`),
  KEY `indonesia_cities_province_code_foreign` (`province_code`),
  CONSTRAINT `indonesia_cities_province_code_foreign` FOREIGN KEY (`province_code`) REFERENCES `indonesia_provinces` (`code`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `indonesia_cities`
--

LOCK TABLES `indonesia_cities` WRITE;
/*!40000 ALTER TABLE `indonesia_cities` DISABLE KEYS */;
/*!40000 ALTER TABLE `indonesia_cities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `indonesia_districts`
--

DROP TABLE IF EXISTS `indonesia_districts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `indonesia_districts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(7) NOT NULL,
  `city_code` char(4) NOT NULL,
  `name` varchar(255) NOT NULL,
  `meta` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `indonesia_districts_code_unique` (`code`),
  KEY `indonesia_districts_city_code_foreign` (`city_code`),
  CONSTRAINT `indonesia_districts_city_code_foreign` FOREIGN KEY (`city_code`) REFERENCES `indonesia_cities` (`code`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `indonesia_districts`
--

LOCK TABLES `indonesia_districts` WRITE;
/*!40000 ALTER TABLE `indonesia_districts` DISABLE KEYS */;
/*!40000 ALTER TABLE `indonesia_districts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `indonesia_provinces`
--

DROP TABLE IF EXISTS `indonesia_provinces`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `indonesia_provinces` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(2) NOT NULL,
  `name` varchar(255) NOT NULL,
  `meta` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `indonesia_provinces_code_unique` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `indonesia_provinces`
--

LOCK TABLES `indonesia_provinces` WRITE;
/*!40000 ALTER TABLE `indonesia_provinces` DISABLE KEYS */;
/*!40000 ALTER TABLE `indonesia_provinces` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `indonesia_villages`
--

DROP TABLE IF EXISTS `indonesia_villages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `indonesia_villages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` char(10) NOT NULL,
  `district_code` char(7) NOT NULL,
  `name` varchar(255) NOT NULL,
  `meta` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `indonesia_villages_code_unique` (`code`),
  KEY `indonesia_villages_district_code_foreign` (`district_code`),
  CONSTRAINT `indonesia_villages_district_code_foreign` FOREIGN KEY (`district_code`) REFERENCES `indonesia_districts` (`code`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `indonesia_villages`
--

LOCK TABLES `indonesia_villages` WRITE;
/*!40000 ALTER TABLE `indonesia_villages` DISABLE KEYS */;
/*!40000 ALTER TABLE `indonesia_villages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_batches`
--

DROP TABLE IF EXISTS `job_batches`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_batches`
--

LOCK TABLES `job_batches` WRITE;
/*!40000 ALTER TABLE `job_batches` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_batches` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `jobs`
--

DROP TABLE IF EXISTS `jobs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `jobs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) unsigned NOT NULL,
  `reserved_at` int(10) unsigned DEFAULT NULL,
  `available_at` int(10) unsigned NOT NULL,
  `created_at` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`),
  KEY `jobs_queue_index` (`queue`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `jobs`
--

LOCK TABLES `jobs` WRITE;
/*!40000 ALTER TABLE `jobs` DISABLE KEYS */;
/*!40000 ALTER TABLE `jobs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `loyalty_point_histories`
--

DROP TABLE IF EXISTS `loyalty_point_histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `loyalty_point_histories` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `transaction_id` bigint(20) unsigned DEFAULT NULL,
  `type` varchar(30) NOT NULL,
  `points_delta` int(11) NOT NULL DEFAULT 0,
  `balance_after` int(10) unsigned NOT NULL DEFAULT 0,
  `amount_delta` bigint(20) unsigned NOT NULL DEFAULT 0,
  `reference` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `loyalty_point_histories_transaction_id_foreign` (`transaction_id`),
  KEY `loyalty_point_histories_customer_id_created_at_index` (`customer_id`,`created_at`),
  KEY `loyalty_point_histories_type_created_at_index` (`type`,`created_at`),
  CONSTRAINT `loyalty_point_histories_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `loyalty_point_histories_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `loyalty_point_histories`
--

LOCK TABLES `loyalty_point_histories` WRITE;
/*!40000 ALTER TABLE `loyalty_point_histories` DISABLE KEYS */;
/*!40000 ALTER TABLE `loyalty_point_histories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `migrations`
--

DROP TABLE IF EXISTS `migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=57 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `migrations`
--

LOCK TABLES `migrations` WRITE;
/*!40000 ALTER TABLE `migrations` DISABLE KEYS */;
INSERT INTO `migrations` VALUES
(1,'0001_01_01_000000_create_users_table',1),
(2,'0001_01_01_000001_create_cache_table',1),
(3,'0001_01_01_000002_create_jobs_table',1),
(4,'2016_08_03_072729_create_provinces_table',1),
(5,'2016_08_03_072750_create_cities_table',1),
(6,'2016_08_03_072804_create_districts_table',1),
(7,'2016_08_03_072819_create_villages_table',1),
(8,'2024_06_13_082620_create_permission_tables',1),
(9,'2024_06_13_091315_add_avatar_field_to_users_table',1),
(10,'2024_06_13_125039_create_customers_table',1),
(11,'2024_06_13_130507_create_categories_table',1),
(12,'2024_06_13_131744_create_products_table',1),
(13,'2024_06_13_132800_create_transactions_table',1),
(14,'2024_06_13_133940_create_transaction_details_table',1),
(15,'2024_06_13_133948_create_carts_table',1),
(16,'2024_06_13_133955_create_profits_table',1),
(17,'2025_11_19_172334_create_payment_settings_table',1),
(18,'2025_11_19_172346_add_payment_columns_to_transactions_table',1),
(19,'2025_12_23_140000_add_hold_columns_to_carts_table',1),
(20,'2025_12_25_200000_create_settings_table',1),
(21,'2025_12_25_230000_create_bank_accounts_table',1),
(22,'2025_12_25_230100_add_bank_transfer_columns',1),
(23,'2025_12_26_010000_add_shipping_cost_to_transactions',1),
(24,'2025_12_28_105534_add_sku_field_to_products_table',1),
(25,'2025_12_30_000000_add_user_avatar_column_if_missing',1),
(26,'2025_12_31_000000_create_product_notification_reads_table',1),
(27,'2025_12_31_010000_add_store_settings_defaults',1),
(28,'2025_12_31_020000_add_region_columns_to_customers_table',1),
(29,'2026_01_01_000000_create_receivables_tables',1),
(30,'2026_01_02_000000_create_suppliers_and_payables_tables',1),
(31,'2026_04_05_000000_add_xendit_callback_token_to_payment_settings_table',1),
(32,'2026_05_01_231134_create_stock_opname_tables',1),
(33,'2026_05_02_000000_create_sales_return_tables',1),
(34,'2026_05_02_010000_create_cashier_shifts_table',1),
(35,'2026_05_02_010100_add_cashier_shift_references',1),
(36,'2026_05_02_120000_create_audit_logs_table',1),
(37,'2026_05_02_120000_encrypt_payment_setting_secrets',1),
(38,'2026_05_04_000001_create_purchase_orders_table',1),
(39,'2026_05_04_000002_create_goods_receivings_table',1),
(40,'2026_05_04_000003_add_purchase_order_id_to_payables_table',1),
(41,'2026_05_04_000004_add_collection_notes_to_receivables_table',1),
(42,'2026_05_05_000001_create_supplier_returns_table',1),
(43,'2026_05_05_000100_create_pricing_rules_table',1),
(44,'2026_05_05_000101_add_pricing_columns_to_transaction_details_table',1),
(45,'2026_05_05_000102_add_loyalty_columns_to_customers_transactions_and_pricing_rules',1),
(46,'2026_05_05_000103_create_loyalty_point_histories_table',1),
(47,'2026_05_05_000104_create_customer_vouchers_table',1),
(48,'2026_05_05_000105_extend_pricing_rules_for_advanced_promotions',1),
(49,'2026_05_05_000106_create_pricing_rule_qty_breaks_table',1),
(50,'2026_05_05_000107_create_pricing_rule_bundle_items_table',1),
(51,'2026_05_05_000108_create_pricing_rule_buy_get_items_table',1),
(52,'2026_05_05_000109_add_loyalty_settings_defaults',1),
(53,'2026_05_06_000110_create_customer_segments_table',1),
(54,'2026_05_06_000111_create_customer_segment_memberships_table',1),
(55,'2026_05_06_000112_create_customer_campaigns_table',1),
(56,'2026_05_06_000113_create_customer_campaign_logs_table',1);
/*!40000 ALTER TABLE `migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_permissions`
--

DROP TABLE IF EXISTS `model_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_permissions`
--

LOCK TABLES `model_has_permissions` WRITE;
/*!40000 ALTER TABLE `model_has_permissions` DISABLE KEYS */;
INSERT INTO `model_has_permissions` VALUES
(1,'App\\Models\\User',1),
(2,'App\\Models\\User',1),
(3,'App\\Models\\User',1),
(4,'App\\Models\\User',1),
(5,'App\\Models\\User',1),
(6,'App\\Models\\User',1),
(7,'App\\Models\\User',1),
(8,'App\\Models\\User',1),
(9,'App\\Models\\User',1),
(10,'App\\Models\\User',1),
(11,'App\\Models\\User',1),
(12,'App\\Models\\User',1),
(13,'App\\Models\\User',1),
(14,'App\\Models\\User',1),
(15,'App\\Models\\User',1),
(16,'App\\Models\\User',1),
(17,'App\\Models\\User',1),
(18,'App\\Models\\User',1),
(19,'App\\Models\\User',1),
(20,'App\\Models\\User',1),
(21,'App\\Models\\User',1),
(22,'App\\Models\\User',1),
(23,'App\\Models\\User',1),
(24,'App\\Models\\User',1),
(25,'App\\Models\\User',1),
(26,'App\\Models\\User',1),
(27,'App\\Models\\User',1),
(28,'App\\Models\\User',1),
(29,'App\\Models\\User',1),
(30,'App\\Models\\User',1),
(31,'App\\Models\\User',1),
(32,'App\\Models\\User',1),
(33,'App\\Models\\User',1),
(34,'App\\Models\\User',1),
(35,'App\\Models\\User',1),
(36,'App\\Models\\User',1),
(37,'App\\Models\\User',1),
(38,'App\\Models\\User',1),
(39,'App\\Models\\User',1),
(40,'App\\Models\\User',1),
(41,'App\\Models\\User',1),
(42,'App\\Models\\User',1),
(43,'App\\Models\\User',1),
(44,'App\\Models\\User',1),
(45,'App\\Models\\User',1),
(46,'App\\Models\\User',1),
(47,'App\\Models\\User',1),
(48,'App\\Models\\User',1),
(49,'App\\Models\\User',1),
(50,'App\\Models\\User',1),
(51,'App\\Models\\User',1),
(52,'App\\Models\\User',1),
(53,'App\\Models\\User',1),
(54,'App\\Models\\User',1),
(55,'App\\Models\\User',1),
(56,'App\\Models\\User',1),
(57,'App\\Models\\User',1),
(58,'App\\Models\\User',1),
(59,'App\\Models\\User',1),
(60,'App\\Models\\User',1),
(61,'App\\Models\\User',1),
(62,'App\\Models\\User',1),
(63,'App\\Models\\User',1),
(64,'App\\Models\\User',1),
(65,'App\\Models\\User',1),
(66,'App\\Models\\User',1),
(67,'App\\Models\\User',1),
(68,'App\\Models\\User',1),
(69,'App\\Models\\User',1),
(70,'App\\Models\\User',1),
(71,'App\\Models\\User',1),
(72,'App\\Models\\User',1),
(73,'App\\Models\\User',1),
(74,'App\\Models\\User',1);
/*!40000 ALTER TABLE `model_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `model_has_roles`
--

DROP TABLE IF EXISTS `model_has_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) unsigned NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`),
  CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `model_has_roles`
--

LOCK TABLES `model_has_roles` WRITE;
/*!40000 ALTER TABLE `model_has_roles` DISABLE KEYS */;
INSERT INTO `model_has_roles` VALUES
(29,'App\\Models\\User',1),
(30,'App\\Models\\User',2);
/*!40000 ALTER TABLE `model_has_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `password_reset_tokens`
--

DROP TABLE IF EXISTS `password_reset_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `password_reset_tokens`
--

LOCK TABLES `password_reset_tokens` WRITE;
/*!40000 ALTER TABLE `password_reset_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `password_reset_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payable_payments`
--

DROP TABLE IF EXISTS `payable_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payable_payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `payable_id` bigint(20) unsigned NOT NULL,
  `paid_at` date DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `method` varchar(30) DEFAULT NULL,
  `bank_account_id` bigint(20) unsigned DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payable_payments_payable_id_foreign` (`payable_id`),
  KEY `payable_payments_bank_account_id_foreign` (`bank_account_id`),
  KEY `payable_payments_user_id_foreign` (`user_id`),
  CONSTRAINT `payable_payments_bank_account_id_foreign` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payable_payments_payable_id_foreign` FOREIGN KEY (`payable_id`) REFERENCES `payables` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payable_payments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payable_payments`
--

LOCK TABLES `payable_payments` WRITE;
/*!40000 ALTER TABLE `payable_payments` DISABLE KEYS */;
INSERT INTO `payable_payments` VALUES
(1,1,'2026-05-03',150000.00,'bank_transfer',NULL,2,'Pembayaran hutang supplier','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,3,'2026-05-03',390000.00,'bank_transfer',NULL,2,'Pembayaran hutang supplier','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,4,'2026-05-03',100000.00,'bank_transfer',NULL,2,'Pembayaran hutang supplier','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(4,6,'2026-05-05',250000.00,'bank_transfer',NULL,1,'Pembayaran DP untuk penerimaan barang.','2026-05-05 15:40:40','2026-05-05 15:40:40');
/*!40000 ALTER TABLE `payable_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payables`
--

DROP TABLE IF EXISTS `payables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payables` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `document_number` varchar(255) NOT NULL,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'unpaid',
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `purchase_order_id` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `payables_supplier_id_foreign` (`supplier_id`),
  KEY `payables_document_number_index` (`document_number`),
  KEY `payables_purchase_order_id_foreign` (`purchase_order_id`),
  CONSTRAINT `payables_purchase_order_id_foreign` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `payables_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payables`
--

LOCK TABLES `payables` WRITE;
/*!40000 ALTER TABLE `payables` DISABLE KEYS */;
INSERT INTO `payables` VALUES
(1,1,'PYB-0001',450000.00,150000.00,'2026-05-20','partial','Pengadaan stok minuman dan snack','2026-05-06 03:40:39','2026-05-06 03:40:39',NULL),
(2,2,'PYB-0002',720000.00,0.00,'2026-05-27','unpaid','Pengadaan produk rumah tangga','2026-05-06 03:40:39','2026-05-06 03:40:39',NULL),
(3,3,'PYB-0003',390000.00,390000.00,'2026-05-04','paid','Pembelian produk susu dan frozen food','2026-05-06 03:40:39','2026-05-06 03:40:39',NULL),
(4,4,'PYB-0004',510000.00,100000.00,'2026-05-01','overdue','Pengadaan barang campuran jatuh tempo','2026-05-06 03:40:39','2026-05-06 03:40:39',NULL),
(5,1,'GR-20260506-0001',163000.00,0.00,'2026-06-05','unpaid','Otomatis dari penerimaan PO PO-20260506-0003','2026-05-06 03:40:39','2026-05-06 03:40:39',3),
(6,3,'GR-20260506-0002',754000.00,250000.00,'2026-05-20','partial','Otomatis dari penerimaan PO PO-20260506-0004','2026-05-06 03:40:40','2026-05-06 03:40:40',4);
/*!40000 ALTER TABLE `payables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_settings`
--

DROP TABLE IF EXISTS `payment_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `default_gateway` varchar(255) NOT NULL DEFAULT 'cash',
  `bank_transfer_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `midtrans_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `midtrans_server_key` text DEFAULT NULL,
  `midtrans_client_key` varchar(255) DEFAULT NULL,
  `midtrans_production` tinyint(1) NOT NULL DEFAULT 0,
  `xendit_enabled` tinyint(1) NOT NULL DEFAULT 0,
  `xendit_secret_key` text DEFAULT NULL,
  `xendit_public_key` varchar(255) DEFAULT NULL,
  `xendit_callback_token` text DEFAULT NULL,
  `xendit_production` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_settings`
--

LOCK TABLES `payment_settings` WRITE;
/*!40000 ALTER TABLE `payment_settings` DISABLE KEYS */;
INSERT INTO `payment_settings` VALUES
(1,'cash',1,0,NULL,NULL,0,0,NULL,NULL,NULL,0,'2026-05-06 03:40:08','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `payment_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=75 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `permissions`
--

LOCK TABLES `permissions` WRITE;
/*!40000 ALTER TABLE `permissions` DISABLE KEYS */;
INSERT INTO `permissions` VALUES
(1,'dashboard-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(2,'users-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(3,'users-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(4,'users-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(5,'users-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(6,'roles-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(7,'roles-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(8,'roles-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(9,'roles-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(10,'permissions-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(11,'permissions-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(12,'permissions-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(13,'permissions-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(14,'categories-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(15,'categories-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(16,'categories-edit','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(17,'categories-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(18,'products-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(19,'products-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(20,'products-edit','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(21,'products-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(22,'pricing-rules-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(23,'pricing-rules-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(24,'pricing-rules-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(25,'pricing-rules-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(26,'customers-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(27,'customers-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(28,'customers-edit','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(29,'customers-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(30,'customer-vouchers-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(31,'customer-vouchers-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(32,'customer-vouchers-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(33,'customer-vouchers-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(34,'customer-segments-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(35,'customer-segments-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(36,'customer-segments-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(37,'customer-segments-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(38,'crm-campaigns-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(39,'crm-campaigns-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(40,'crm-campaigns-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(41,'crm-campaigns-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(42,'crm-reminders-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(43,'transactions-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(44,'transactions-confirm-payment','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(45,'receivables-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(46,'receivables-pay','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(47,'payables-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(48,'payables-pay','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(49,'suppliers-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(50,'reports-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(51,'profits-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(52,'payment-settings-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(53,'payment-settings-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(54,'stock-opnames-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(55,'stock-opnames-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(56,'stock-opnames-finalize','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(57,'stock-mutations-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(58,'sales-returns-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(59,'sales-returns-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(60,'sales-returns-complete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(61,'cashier-shifts-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(62,'cashier-shifts-open','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(63,'cashier-shifts-close','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(64,'cashier-shifts-force-close','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(65,'audit-logs-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(66,'purchase-orders-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(67,'purchase-orders-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(68,'purchase-orders-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(69,'purchase-orders-delete','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(70,'goods-receivings-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(71,'goods-receivings-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(72,'supplier-returns-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(73,'supplier-returns-create','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(74,'supplier-returns-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07');
/*!40000 ALTER TABLE `permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_rule_bundle_items`
--

DROP TABLE IF EXISTS `pricing_rule_bundle_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_rule_bundle_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `pricing_rule_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pricing_rule_bundle_items_product_id_foreign` (`product_id`),
  KEY `pricing_rule_bundle_items_pricing_rule_id_sort_order_index` (`pricing_rule_id`,`sort_order`),
  CONSTRAINT `pricing_rule_bundle_items_pricing_rule_id_foreign` FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pricing_rule_bundle_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_rule_bundle_items`
--

LOCK TABLES `pricing_rule_bundle_items` WRITE;
/*!40000 ALTER TABLE `pricing_rule_bundle_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `pricing_rule_bundle_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_rule_buy_get_items`
--

DROP TABLE IF EXISTS `pricing_rule_buy_get_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_rule_buy_get_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `pricing_rule_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `role` varchar(10) NOT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pricing_rule_buy_get_items_product_id_foreign` (`product_id`),
  KEY `pricing_rule_buy_get_items_pricing_rule_id_role_sort_order_index` (`pricing_rule_id`,`role`,`sort_order`),
  CONSTRAINT `pricing_rule_buy_get_items_pricing_rule_id_foreign` FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pricing_rule_buy_get_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_rule_buy_get_items`
--

LOCK TABLES `pricing_rule_buy_get_items` WRITE;
/*!40000 ALTER TABLE `pricing_rule_buy_get_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `pricing_rule_buy_get_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_rule_qty_breaks`
--

DROP TABLE IF EXISTS `pricing_rule_qty_breaks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_rule_qty_breaks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `pricing_rule_id` bigint(20) unsigned NOT NULL,
  `min_qty` int(10) unsigned NOT NULL,
  `discount_type` varchar(20) NOT NULL,
  `discount_value` decimal(15,2) NOT NULL,
  `sort_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pricing_rule_qty_breaks_pricing_rule_id_min_qty_index` (`pricing_rule_id`,`min_qty`),
  CONSTRAINT `pricing_rule_qty_breaks_pricing_rule_id_foreign` FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_rule_qty_breaks`
--

LOCK TABLES `pricing_rule_qty_breaks` WRITE;
/*!40000 ALTER TABLE `pricing_rule_qty_breaks` DISABLE KEYS */;
/*!40000 ALTER TABLE `pricing_rule_qty_breaks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pricing_rules`
--

DROP TABLE IF EXISTS `pricing_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `pricing_rules` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `kind` varchar(30) NOT NULL DEFAULT 'standard_discount',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `priority` int(10) unsigned NOT NULL DEFAULT 0,
  `target_type` varchar(20) NOT NULL DEFAULT 'all',
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `category_id` bigint(20) unsigned DEFAULT NULL,
  `customer_scope` varchar(20) NOT NULL DEFAULT 'all',
  `eligible_loyalty_tiers` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`eligible_loyalty_tiers`)),
  `discount_type` varchar(20) NOT NULL,
  `discount_value` decimal(15,2) NOT NULL,
  `starts_at` timestamp NULL DEFAULT NULL,
  `ends_at` timestamp NULL DEFAULT NULL,
  `preview_quantity_multiplier` int(10) unsigned NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `pricing_rules_product_id_foreign` (`product_id`),
  KEY `pricing_rules_category_id_foreign` (`category_id`),
  KEY `pricing_rules_created_by_foreign` (`created_by`),
  KEY `pricing_rules_is_active_priority_index` (`is_active`,`priority`),
  KEY `pricing_rules_target_type_product_id_category_id_index` (`target_type`,`product_id`,`category_id`),
  KEY `pricing_rules_customer_scope_starts_at_ends_at_index` (`customer_scope`,`starts_at`,`ends_at`),
  KEY `pricing_rules_kind_is_active_priority_index` (`kind`,`is_active`,`priority`),
  CONSTRAINT `pricing_rules_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pricing_rules_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `pricing_rules_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pricing_rules`
--

LOCK TABLES `pricing_rules` WRITE;
/*!40000 ALTER TABLE `pricing_rules` DISABLE KEYS */;
/*!40000 ALTER TABLE `pricing_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_notification_reads`
--

DROP TABLE IF EXISTS `product_notification_reads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_notification_reads` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_notification_reads_user_id_product_id_unique` (`user_id`,`product_id`),
  KEY `product_notification_reads_product_id_foreign` (`product_id`),
  CONSTRAINT `product_notification_reads_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_notification_reads_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_notification_reads`
--

LOCK TABLES `product_notification_reads` WRITE;
/*!40000 ALTER TABLE `product_notification_reads` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_notification_reads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) unsigned NOT NULL,
  `image` varchar(255) NOT NULL,
  `barcode` varchar(255) NOT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `buy_price` bigint(20) NOT NULL,
  `sell_price` bigint(20) NOT NULL,
  `stock` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_barcode_unique` (`barcode`),
  UNIQUE KEY `products_sku_unique` (`sku`),
  KEY `products_category_id_foreign` (`category_id`),
  CONSTRAINT `products_category_id_foreign` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
INSERT INTO `products` VALUES
(1,1,'prod-aqua-botol-600ml.jpg','MNM-0001',NULL,'Aqua Botol 600ml','Air mineral murni dalam kemasan botol praktis',3000,5000,228,'2026-05-06 03:40:16','2026-05-06 03:40:39'),
(2,1,'prod-teh-botol-sosro-450ml.jpg','MNM-0002',NULL,'Teh Botol Sosro 450ml','Teh manis segar dalam kemasan botol',4000,6000,148,'2026-05-06 03:40:17','2026-05-06 03:40:39'),
(3,1,'prod-kopi-susu-gula-aren.jpg','MNM-0003',NULL,'Kopi Susu Gula Aren','Kopi susu dengan gula aren asli',12000,18000,79,'2026-05-06 03:40:18','2026-05-06 03:40:39'),
(4,1,'prod-jus-jeruk-segar-500ml.jpg','MNM-0004',NULL,'Jus Jeruk Segar 500ml','Jus jeruk murni tanpa pengawet',8000,12000,60,'2026-05-06 03:40:19','2026-05-06 03:40:19'),
(5,2,'prod-chitato-original-68g.jpg','SNK-0001',NULL,'Chitato Original 68g','Keripik kentang renyah rasa original',8000,12000,128,'2026-05-06 03:40:20','2026-05-06 03:40:39'),
(6,2,'prod-oreo-vanilla-133g.jpg','SNK-0002',NULL,'Oreo Vanilla 133g','Biskuit sandwich dengan krim vanilla',10000,15000,99,'2026-05-06 03:40:20','2026-05-06 03:40:39'),
(7,2,'prod-indomie-goreng.jpg','SNK-0003',NULL,'Indomie Goreng','Mie instant goreng favorit Indonesia',2500,3500,295,'2026-05-06 03:40:21','2026-05-06 03:40:39'),
(8,2,'prod-pringles-sour-cream.jpg','SNK-0004',NULL,'Pringles Sour Cream','Keripik kentang premium rasa sour cream',25000,35000,50,'2026-05-06 03:40:22','2026-05-06 03:40:22'),
(9,3,'prod-nasi-goreng-frozen.jpg','MKN-0001',NULL,'Nasi Goreng Frozen','Nasi goreng siap saji tinggal panaskan',15000,22000,40,'2026-05-06 03:40:23','2026-05-06 03:40:23'),
(10,3,'prod-ayam-goreng-frozen.jpg','MKN-0002',NULL,'Ayam Goreng Frozen','Ayam goreng krispy siap goreng',25000,38000,32,'2026-05-06 03:40:23','2026-05-06 03:40:40'),
(11,3,'prod-sosis-sapi-500g.jpg','MKN-0003',NULL,'Sosis Sapi 500g','Sosis sapi premium isi 12 pcs',35000,48000,43,'2026-05-06 03:40:24','2026-05-06 03:40:39'),
(12,4,'prod-ultra-milk-1l.jpg','SSU-0001',NULL,'Ultra Milk 1L','Susu UHT full cream',16000,21000,80,'2026-05-06 03:40:25','2026-05-06 03:40:40'),
(13,4,'prod-yogurt-cimory-250ml.jpg','SSU-0002',NULL,'Yogurt Cimory 250ml','Yogurt drink rasa strawberry',8000,12000,58,'2026-05-06 03:40:25','2026-05-06 03:40:40'),
(14,4,'prod-keju-cheddar-165g.jpg','SSU-0003',NULL,'Keju Cheddar 165g','Keju cheddar slice praktis',22000,30000,40,'2026-05-06 03:40:26','2026-05-06 03:40:26'),
(15,5,'prod-roti-tawar-sari-roti.jpg','RTI-0001',NULL,'Roti Tawar Sari Roti','Roti tawar lembut tanpa kulit',12000,16000,49,'2026-05-06 03:40:27','2026-05-06 03:40:38'),
(16,5,'prod-donat-coklat.jpg','RTI-0002',NULL,'Donat Coklat','Donat lembut dengan topping coklat',5000,8000,26,'2026-05-06 03:40:28','2026-05-06 21:10:43'),
(17,5,'prod-croissant-butter.jpg','RTI-0003',NULL,'Croissant Butter','Croissant dengan butter premium',10000,15000,24,'2026-05-06 03:40:29','2026-05-06 21:10:43'),
(18,6,'prod-kecap-manis-abc-600ml.jpg','BMB-0001',NULL,'Kecap Manis ABC 600ml','Kecap manis kualitas premium',18000,25000,68,'2026-05-06 03:40:30','2026-05-06 03:40:39'),
(19,6,'prod-minyak-goreng-2l.jpg','BMB-0002',NULL,'Minyak Goreng 2L','Minyak goreng sawit berkualitas',28000,38000,89,'2026-05-06 03:40:30','2026-05-06 03:40:39'),
(20,6,'prod-gula-pasir-1kg.jpg','BMB-0003',NULL,'Gula Pasir 1kg','Gula pasir putih premium',14000,18000,100,'2026-05-06 03:40:31','2026-05-06 03:40:31'),
(21,7,'prod-sabun-lifebuoy-85g.jpg','PRW-0001',NULL,'Sabun Lifebuoy 85g','Sabun mandi antibakteri',4000,6500,148,'2026-05-06 03:40:32','2026-05-06 03:40:39'),
(22,7,'prod-shampoo-pantene-170ml.jpg','PRW-0002',NULL,'Shampoo Pantene 170ml','Shampoo anti rontok',22000,32000,59,'2026-05-06 03:40:33','2026-05-06 03:40:39'),
(23,7,'prod-pasta-gigi-pepsodent-190g.jpg','PRW-0003',NULL,'Pasta Gigi Pepsodent 190g','Pasta gigi pencegah gigi berlubang',12000,18000,100,'2026-05-06 03:40:34','2026-05-06 03:40:34'),
(24,8,'prod-tisu-paseo-250-sheet.jpg','RMH-0001',NULL,'Tisu Paseo 250 Sheet','Tisu wajah lembut dan kuat',15000,22000,78,'2026-05-06 03:40:35','2026-05-06 03:40:39'),
(25,8,'default.jpg','RMH-0002',NULL,'Sabun Cuci Piring 800ml','Sabun cuci piring anti lemak',12000,18000,90,'2026-05-06 03:40:37','2026-05-06 03:40:37'),
(26,8,'prod-pewangi-pakaian-900ml.jpg','RMH-0003',NULL,'Pewangi Pakaian 900ml','Pelembut dan pewangi pakaian',18000,26000,69,'2026-05-06 03:40:38','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profits`
--

DROP TABLE IF EXISTS `profits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `profits` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transaction_id` bigint(20) unsigned NOT NULL,
  `total` bigint(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `profits_transaction_id_foreign` (`transaction_id`),
  CONSTRAINT `profits_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profits`
--

LOCK TABLES `profits` WRITE;
/*!40000 ALTER TABLE `profits` DISABLE KEYS */;
INSERT INTO `profits` VALUES
(1,1,6000,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(2,1,8000,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(3,1,4000,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(4,2,10000,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(5,2,9000,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(6,2,5000,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(7,3,26000,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(8,3,10000,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(9,3,14000,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(10,4,12000,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(11,4,5000,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(12,4,8000,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(13,5,10000,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(14,5,14000,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(15,5,26000,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(16,5,8000,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(17,6,4000,'2026-05-06 03:00:00','2026-05-06 03:00:00'),
(18,6,5000,'2026-05-06 03:00:00','2026-05-06 03:00:00'),
(19,1,-2000,'2026-05-04 04:00:00','2026-05-04 04:00:00'),
(20,4,-6000,'2026-05-06 04:00:00','2026-05-06 04:00:00'),
(21,7,3000,'2026-05-06 21:10:43','2026-05-06 21:10:43'),
(22,7,5000,'2026-05-06 21:10:43','2026-05-06 21:10:43');
/*!40000 ALTER TABLE `profits` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_order_items`
--

DROP TABLE IF EXISTS `purchase_order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `purchase_order_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `qty_ordered` int(11) NOT NULL DEFAULT 0,
  `qty_received` int(11) NOT NULL DEFAULT 0,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `purchase_order_items_purchase_order_id_foreign` (`purchase_order_id`),
  KEY `purchase_order_items_product_id_foreign` (`product_id`),
  CONSTRAINT `purchase_order_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `purchase_order_items_purchase_order_id_foreign` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_order_items`
--

LOCK TABLES `purchase_order_items` WRITE;
/*!40000 ALTER TABLE `purchase_order_items` DISABLE KEYS */;
INSERT INTO `purchase_order_items` VALUES
(1,1,24,18,0,14000.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,1,25,12,0,11500.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,2,21,30,0,3800.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(4,2,23,20,0,11500.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(5,3,1,48,30,2900.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(6,3,5,24,10,7600.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(7,4,10,15,15,24800.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(8,4,12,20,20,15500.00,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(9,4,13,16,16,7600.00,'2026-05-06 03:40:39','2026-05-06 03:40:40');
/*!40000 ALTER TABLE `purchase_order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `purchase_orders`
--

DROP TABLE IF EXISTS `purchase_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `purchase_orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `document_number` varchar(255) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `ordered_at` timestamp NULL DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_orders_document_number_unique` (`document_number`),
  KEY `purchase_orders_supplier_id_foreign` (`supplier_id`),
  KEY `purchase_orders_created_by_foreign` (`created_by`),
  CONSTRAINT `purchase_orders_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `purchase_orders_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `purchase_orders`
--

LOCK TABLES `purchase_orders` WRITE;
/*!40000 ALTER TABLE `purchase_orders` DISABLE KEYS */;
INSERT INTO `purchase_orders` VALUES
(1,2,'PO-20260506-0001','draft','Draft pengadaan perlengkapan rumah tangga akhir minggu.',1,NULL,NULL,'2026-05-02 02:15:00','2026-05-02 02:15:00'),
(2,4,'PO-20260506-0002','cancelled','PO dibatalkan karena harga supplier berubah.',1,'2026-04-30 03:00:00',NULL,'2026-04-30 02:00:00','2026-05-01 04:00:00'),
(3,1,'PO-20260506-0003','partial_received','PO barang cepat laku untuk restock mingguan.',1,'2026-05-03 01:30:00',NULL,'2026-05-03 01:00:00','2026-05-04 03:15:00'),
(4,3,'PO-20260506-0004','completed','PO lengkap untuk frozen food dan produk susu.',1,'2026-05-04 00:45:00','2026-05-05 04:10:00','2026-05-04 00:20:00','2026-05-05 04:10:00');
/*!40000 ALTER TABLE `purchase_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receivable_payments`
--

DROP TABLE IF EXISTS `receivable_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `receivable_payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `receivable_id` bigint(20) unsigned NOT NULL,
  `paid_at` date DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `method` varchar(30) DEFAULT NULL,
  `bank_account_id` bigint(20) unsigned DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `receivable_payments_receivable_id_foreign` (`receivable_id`),
  KEY `receivable_payments_bank_account_id_foreign` (`bank_account_id`),
  KEY `receivable_payments_user_id_foreign` (`user_id`),
  CONSTRAINT `receivable_payments_bank_account_id_foreign` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `receivable_payments_receivable_id_foreign` FOREIGN KEY (`receivable_id`) REFERENCES `receivables` (`id`) ON DELETE CASCADE,
  CONSTRAINT `receivable_payments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receivable_payments`
--

LOCK TABLES `receivable_payments` WRITE;
/*!40000 ALTER TABLE `receivable_payments` DISABLE KEYS */;
INSERT INTO `receivable_payments` VALUES
(1,1,'2026-05-04',20000.00,'cash',NULL,2,'Pembayaran awal piutang','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,2,'2026-05-03',55300.00,'cash',NULL,2,'Pembayaran awal piutang','2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,4,'2026-05-05',50000.00,'bank_transfer',NULL,2,'Pembayaran sebagian piutang manual','2026-05-06 03:40:39','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `receivable_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receivables`
--

DROP TABLE IF EXISTS `receivables`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `receivables` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `transaction_id` bigint(20) unsigned DEFAULT NULL,
  `invoice` varchar(255) NOT NULL,
  `total` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid` decimal(15,2) NOT NULL DEFAULT 0.00,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'unpaid',
  `note` text DEFAULT NULL,
  `collection_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `receivables_customer_id_foreign` (`customer_id`),
  KEY `receivables_transaction_id_foreign` (`transaction_id`),
  KEY `receivables_invoice_index` (`invoice`),
  CONSTRAINT `receivables_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `receivables_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receivables`
--

LOCK TABLES `receivables` WRITE;
/*!40000 ALTER TABLE `receivables` DISABLE KEYS */;
INSERT INTO `receivables` VALUES
(1,1,1,'RCV-TRX-BHYKODRS',50000.00,20000.00,'2026-05-13','partial','Piutang dari transaksi penjualan TRX-BHYKODRS',NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,2,2,'RCV-TRX-WZEDFSQA',79000.00,55300.00,'2026-05-20','partial','Piutang dari transaksi penjualan TRX-WZEDFSQA',NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,3,3,'RCV-TRX-EAP7GPAE',148000.00,0.00,'2026-05-27','unpaid','Piutang dari transaksi penjualan TRX-EAP7GPAE',NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(4,7,NULL,'RCV-MANUAL-001',185000.00,50000.00,'2026-05-16','partial','Piutang manual untuk pembelian grosir bulanan',NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(5,8,NULL,'RCV-MANUAL-002',275000.00,0.00,'2026-05-03','overdue','Piutang manual yang sudah melewati jatuh tempo',NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `receivables` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `role_has_permissions`
--

DROP TABLE IF EXISTS `role_has_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) unsigned NOT NULL,
  `role_id` bigint(20) unsigned NOT NULL,
  PRIMARY KEY (`permission_id`,`role_id`),
  KEY `role_has_permissions_role_id_foreign` (`role_id`),
  CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `role_has_permissions`
--

LOCK TABLES `role_has_permissions` WRITE;
/*!40000 ALTER TABLE `role_has_permissions` DISABLE KEYS */;
INSERT INTO `role_has_permissions` VALUES
(1,29),
(1,30),
(2,1),
(2,29),
(3,1),
(3,29),
(4,1),
(4,29),
(5,1),
(5,29),
(6,2),
(6,29),
(7,2),
(7,29),
(8,2),
(8,29),
(9,2),
(9,29),
(10,3),
(10,29),
(11,3),
(11,29),
(12,3),
(12,29),
(13,3),
(13,29),
(14,4),
(14,29),
(15,4),
(15,29),
(16,4),
(16,29),
(17,4),
(17,29),
(18,5),
(18,29),
(19,5),
(19,29),
(20,5),
(20,29),
(21,5),
(21,29),
(22,6),
(22,29),
(23,6),
(23,29),
(24,6),
(24,29),
(25,6),
(25,29),
(26,7),
(26,29),
(26,30),
(27,7),
(27,29),
(27,30),
(28,7),
(28,29),
(29,7),
(29,29),
(30,8),
(30,29),
(31,8),
(31,29),
(32,8),
(32,29),
(33,8),
(33,29),
(34,9),
(34,29),
(35,9),
(35,29),
(36,9),
(36,29),
(37,9),
(37,29),
(38,10),
(38,29),
(39,10),
(39,29),
(40,10),
(40,29),
(41,10),
(41,29),
(42,11),
(42,29),
(43,12),
(43,29),
(43,30),
(44,12),
(44,13),
(44,29),
(45,14),
(45,29),
(45,30),
(46,14),
(46,29),
(46,30),
(47,15),
(47,29),
(47,30),
(48,15),
(48,29),
(48,30),
(49,16),
(49,29),
(49,30),
(50,17),
(50,29),
(51,18),
(51,29),
(52,19),
(52,29),
(53,19),
(53,20),
(53,29),
(54,21),
(54,29),
(55,21),
(55,29),
(56,21),
(56,29),
(57,22),
(57,29),
(58,23),
(58,29),
(59,23),
(59,29),
(60,23),
(60,29),
(61,24),
(61,29),
(61,30),
(62,24),
(62,29),
(62,30),
(63,24),
(63,29),
(63,30),
(64,24),
(64,29),
(65,25),
(65,29),
(66,26),
(66,29),
(67,26),
(67,29),
(68,26),
(68,29),
(69,26),
(69,29),
(70,27),
(70,29),
(71,27),
(71,29),
(72,28),
(72,29),
(73,28),
(73,29),
(74,28),
(74,29);
/*!40000 ALTER TABLE `role_has_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles`
--

LOCK TABLES `roles` WRITE;
/*!40000 ALTER TABLE `roles` DISABLE KEYS */;
INSERT INTO `roles` VALUES
(1,'users-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(2,'roles-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(3,'permissions-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(4,'categories-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(5,'products-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(6,'pricing-rules-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(7,'customers-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(8,'customer-vouchers-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(9,'customer-segments-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(10,'crm-campaigns-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(11,'crm-reminders-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(12,'transactions-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(13,'transactions-confirm-payment','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(14,'receivables-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(15,'payables-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(16,'suppliers-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(17,'reports-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(18,'profits-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(19,'payment-settings-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(20,'payment-settings-update','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(21,'stock-opnames-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(22,'stock-mutations-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(23,'sales-returns-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(24,'cashier-shifts-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(25,'audit-logs-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(26,'purchase-orders-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(27,'goods-receivings-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(28,'supplier-returns-access','web','2026-05-06 03:40:07','2026-05-06 03:40:07'),
(29,'super-admin','web','2026-05-06 03:40:08','2026-05-06 03:40:08'),
(30,'cashier','web','2026-05-06 03:40:08','2026-05-06 03:40:08');
/*!40000 ALTER TABLE `roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_return_items`
--

DROP TABLE IF EXISTS `sales_return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_return_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `sales_return_id` bigint(20) unsigned NOT NULL,
  `transaction_detail_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `qty_sold` int(11) NOT NULL,
  `qty_returned_before` int(11) NOT NULL DEFAULT 0,
  `qty_return` int(11) NOT NULL,
  `unit_price` bigint(20) NOT NULL,
  `subtotal` bigint(20) NOT NULL,
  `return_reason` varchar(255) NOT NULL,
  `restock_to_inventory` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sales_return_items_sales_return_id_foreign` (`sales_return_id`),
  KEY `sales_return_items_transaction_detail_id_foreign` (`transaction_detail_id`),
  KEY `sales_return_items_product_id_foreign` (`product_id`),
  CONSTRAINT `sales_return_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_return_items_sales_return_id_foreign` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sales_return_items_transaction_detail_id_foreign` FOREIGN KEY (`transaction_detail_id`) REFERENCES `transaction_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_return_items`
--

LOCK TABLES `sales_return_items` WRITE;
/*!40000 ALTER TABLE `sales_return_items` DISABLE KEYS */;
INSERT INTO `sales_return_items` VALUES
(1,1,1,1,3,0,1,5000,5000,'Pelanggan menerima credit note untuk item yang tidak sesuai.',1,'2026-05-04 04:00:00','2026-05-04 04:00:00'),
(2,2,10,3,2,0,1,18000,18000,'Barang dikembalikan dan dana dikembalikan tunai.',1,'2026-05-06 04:00:00','2026-05-06 04:00:00'),
(3,3,3,15,1,0,1,16000,16000,'Menunggu konfirmasi retur dari admin.',1,'2026-05-06 03:40:39','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `sales_return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sales_returns`
--

DROP TABLE IF EXISTS `sales_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sales_returns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(255) NOT NULL,
  `transaction_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `cashier_id` bigint(20) unsigned DEFAULT NULL,
  `cashier_shift_id` bigint(20) unsigned DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `return_type` varchar(30) NOT NULL DEFAULT 'refund_cash',
  `refund_amount` bigint(20) NOT NULL DEFAULT 0,
  `credited_amount` bigint(20) NOT NULL DEFAULT 0,
  `total_return_amount` bigint(20) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sales_returns_code_unique` (`code`),
  KEY `sales_returns_customer_id_foreign` (`customer_id`),
  KEY `sales_returns_cashier_id_foreign` (`cashier_id`),
  KEY `sales_returns_transaction_id_status_index` (`transaction_id`,`status`),
  KEY `sales_returns_cashier_shift_id_foreign` (`cashier_shift_id`),
  CONSTRAINT `sales_returns_cashier_id_foreign` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_returns_cashier_shift_id_foreign` FOREIGN KEY (`cashier_shift_id`) REFERENCES `cashier_shifts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_returns_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sales_returns_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sales_returns`
--

LOCK TABLES `sales_returns` WRITE;
/*!40000 ALTER TABLE `sales_returns` DISABLE KEYS */;
INSERT INTO `sales_returns` VALUES
(1,'SR-20260506104039-GA0R',1,1,2,1,'completed','store_credit',0,5000,5000,'Retur sample untuk module 3 dengan store credit.','2026-05-04 04:00:00','2026-05-04 04:00:00','2026-05-04 04:00:00'),
(2,'SR-20260506104039-UVU2',4,4,2,3,'completed','refund_cash',18000,0,18000,'Retur sample untuk cash refund.','2026-05-06 04:00:00','2026-05-06 04:00:00','2026-05-06 04:00:00'),
(3,'SR-20260506104039-YNJ8',1,1,2,NULL,'draft','refund_cash',16000,0,16000,'Draft retur sample yang belum difinalisasi.',NULL,'2026-05-06 03:40:39','2026-05-06 03:40:39');
/*!40000 ALTER TABLE `sales_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `sessions_user_id_index` (`user_id`),
  KEY `sessions_last_activity_index` (`last_activity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sessions`
--

LOCK TABLES `sessions` WRITE;
/*!40000 ALTER TABLE `sessions` DISABLE KEYS */;
INSERT INTO `sessions` VALUES
('hVZB5YjiSJ7LOwSSyDIbKry98CkU4YoS7JCR8tgV',NULL,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','YTozOntzOjY6Il90b2tlbiI7czo0MDoibG1sRks0b2UzOVdsZlVHWmt3cWg1Q0RlRTNQaDR6Zkg1SU9VbDlObCI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==',1778127386),
('KrJ6JZMjZV0NPVfAH6mvvGUPknj913VONM8SzeVC',1,'127.0.0.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36','YTo1OntzOjY6Il90b2tlbiI7czo0MDoid2RVU3NXWTFHY1NZbkNBQzlEUFAyVngxV25ZMVJ6d1NzZGQ2SmVKeSI7czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo1MDoibG9naW5fd2ViXzU5YmEzNmFkZGMyYjJmOTQwMTU4MGYwMTRjN2Y1OGVhNGUzMDk4OWQiO2k6MTtzOjg6InNlY3VyaXR5IjthOjE6e3M6MTg6InNlc3Npb25fc3RhcnRlZF9hdCI7aToxNzc4MTI2OTc5O319',1778129646);
/*!40000 ALTER TABLE `sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `settings`
--

DROP TABLE IF EXISTS `settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `settings` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key` varchar(255) NOT NULL,
  `value` text DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settings_key_unique` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `settings`
--

LOCK TABLES `settings` WRITE;
/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` VALUES
(1,'monthly_sales_target','15000000','Target penjualan bulanan','2026-05-06 03:40:02','2026-05-06 03:40:39'),
(2,'store_name','POINZA STORE','Nama toko','2026-05-06 03:40:02','2026-05-06 21:12:45'),
(3,'store_logo',NULL,'Logo toko','2026-05-06 03:40:02','2026-05-06 03:40:02'),
(4,'store_address','Magelang','Alamat toko','2026-05-06 03:40:02','2026-05-06 21:12:39'),
(5,'store_phone','085868464443','Telepon toko','2026-05-06 03:40:02','2026-05-06 21:12:39'),
(6,'store_email','halo@poinza.store','Email toko','2026-05-06 03:40:02','2026-05-06 21:12:39'),
(7,'store_website','https://poinza.store','Website toko','2026-05-06 03:40:02','2026-05-06 21:12:39'),
(8,'store_city','magelang','Kota/Kabupaten toko','2026-05-06 03:40:02','2026-05-06 21:12:39'),
(9,'loyalty_enable_earn','1','Aktifkan perolehan poin loyalty','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(10,'loyalty_enable_redeem','1','Aktifkan redeem poin loyalty','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(11,'loyalty_earn_rate_amount','10000','Nominal belanja untuk mendapatkan 1 poin','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(12,'loyalty_redeem_point_value','100','Nilai rupiah untuk 1 poin redeem','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(13,'loyalty_tier_regular_threshold','0','Ambang total belanja tier Regular','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(14,'loyalty_tier_silver_threshold','500000','Ambang total belanja tier Silver','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(15,'loyalty_tier_gold_threshold','1500000','Ambang total belanja tier Gold','2026-05-06 03:40:06','2026-05-06 03:40:06'),
(16,'loyalty_tier_platinum_threshold','3000000','Ambang total belanja tier Platinum','2026-05-06 03:40:06','2026-05-06 03:40:06');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_mutations`
--

DROP TABLE IF EXISTS `stock_mutations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_mutations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `reference_type` varchar(50) NOT NULL,
  `reference_id` bigint(20) unsigned DEFAULT NULL,
  `mutation_type` varchar(20) NOT NULL,
  `qty` int(11) NOT NULL,
  `stock_before` int(11) NOT NULL,
  `stock_after` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `stock_mutations_product_id_foreign` (`product_id`),
  KEY `stock_mutations_created_by_foreign` (`created_by`),
  KEY `stock_mutations_reference_type_reference_id_index` (`reference_type`,`reference_id`),
  CONSTRAINT `stock_mutations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_mutations_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_mutations`
--

LOCK TABLES `stock_mutations` WRITE;
/*!40000 ALTER TABLE `stock_mutations` DISABLE KEYS */;
INSERT INTO `stock_mutations` VALUES
(1,1,'sales_return',1,'in',1,197,198,'Pelanggan menerima credit note untuk item yang tidak sesuai.',2,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(2,3,'sales_return',2,'in',1,78,79,'Barang dikembalikan dan dana dikembalikan tunai.',2,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(3,1,'goods_receiving',1,'in',30,198,228,'Penerimaan dari PO PO-20260506-0003',2,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(4,5,'goods_receiving',1,'in',10,118,128,'Penerimaan dari PO PO-20260506-0003',2,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(5,10,'goods_receiving',2,'in',15,33,48,'Penerimaan dari PO PO-20260506-0004',2,'2026-05-06 03:40:39','2026-05-06 03:40:39'),
(6,12,'goods_receiving',2,'in',20,78,98,'Penerimaan dari PO PO-20260506-0004',2,'2026-05-06 03:40:40','2026-05-06 03:40:40'),
(7,13,'goods_receiving',2,'in',16,58,74,'Penerimaan dari PO PO-20260506-0004',2,'2026-05-06 03:40:40','2026-05-06 03:40:40'),
(8,10,'supplier_return',2,'out',2,48,46,'Segel kemasan rusak',1,'2026-05-06 03:40:40','2026-05-06 03:40:40'),
(9,10,'stock_opname',2,'adjustment',14,46,32,'Satu pcs rusak saat bongkar muat.',1,'2026-05-06 03:40:40','2026-05-06 03:40:40'),
(10,12,'stock_opname',2,'adjustment',18,98,80,'Temuan stok terselip di rak pendingin.',1,'2026-05-06 03:40:40','2026-05-06 03:40:40'),
(11,13,'stock_opname',2,'adjustment',16,74,58,'Adjustment dari stock opname.',1,'2026-05-06 03:40:40','2026-05-06 03:40:40');
/*!40000 ALTER TABLE `stock_mutations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_opname_items`
--

DROP TABLE IF EXISTS `stock_opname_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_opname_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `stock_opname_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `system_stock` int(11) NOT NULL,
  `physical_stock` int(11) DEFAULT NULL,
  `difference` int(11) DEFAULT NULL,
  `adjustment_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_opname_items_stock_opname_id_product_id_unique` (`stock_opname_id`,`product_id`),
  KEY `stock_opname_items_product_id_foreign` (`product_id`),
  CONSTRAINT `stock_opname_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_opname_items_stock_opname_id_foreign` FOREIGN KEY (`stock_opname_id`) REFERENCES `stock_opnames` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_opname_items`
--

LOCK TABLES `stock_opname_items` WRITE;
/*!40000 ALTER TABLE `stock_opname_items` DISABLE KEYS */;
INSERT INTO `stock_opname_items` VALUES
(1,1,2,148,NULL,NULL,NULL,'2026-05-05 22:40:40','2026-05-05 22:40:40'),
(2,1,6,99,NULL,NULL,NULL,'2026-05-05 22:40:40','2026-05-05 22:40:40'),
(3,1,25,90,NULL,NULL,NULL,'2026-05-05 22:40:40','2026-05-05 22:40:40'),
(4,2,10,33,32,-1,'Satu pcs rusak saat bongkar muat.','2026-05-06 00:40:40','2026-05-06 00:40:40'),
(5,2,12,78,80,2,'Temuan stok terselip di rak pendingin.','2026-05-06 00:40:40','2026-05-06 00:40:40'),
(6,2,13,58,58,0,NULL,'2026-05-06 00:40:40','2026-05-06 00:40:40');
/*!40000 ALTER TABLE `stock_opname_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock_opnames`
--

DROP TABLE IF EXISTS `stock_opnames`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock_opnames` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(255) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `finalized_by` bigint(20) unsigned DEFAULT NULL,
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stock_opnames_code_unique` (`code`),
  KEY `stock_opnames_created_by_foreign` (`created_by`),
  KEY `stock_opnames_finalized_by_foreign` (`finalized_by`),
  CONSTRAINT `stock_opnames_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_opnames_finalized_by_foreign` FOREIGN KEY (`finalized_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock_opnames`
--

LOCK TABLES `stock_opnames` WRITE;
/*!40000 ALTER TABLE `stock_opnames` DISABLE KEYS */;
INSERT INTO `stock_opnames` VALUES
(1,'SO-DRAFT-001','draft','Sesi stock opname rak depan, belum semua item dihitung.',1,NULL,NULL,'2026-05-05 22:40:40','2026-05-05 22:40:40'),
(2,'SO-FINAL-001','finalized','Opname gudang pendingin untuk batch awal pekan.',1,1,'2026-05-06 01:40:40','2026-05-06 00:40:40','2026-05-06 01:40:40');
/*!40000 ALTER TABLE `stock_opnames` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_return_items`
--

DROP TABLE IF EXISTS `supplier_return_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_return_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `supplier_return_id` bigint(20) unsigned NOT NULL,
  `goods_receiving_item_id` bigint(20) unsigned DEFAULT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `qty_returned` int(11) NOT NULL DEFAULT 0,
  `unit_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `reason` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `supplier_return_items_supplier_return_id_foreign` (`supplier_return_id`),
  KEY `supplier_return_items_goods_receiving_item_id_foreign` (`goods_receiving_item_id`),
  KEY `supplier_return_items_product_id_foreign` (`product_id`),
  CONSTRAINT `supplier_return_items_goods_receiving_item_id_foreign` FOREIGN KEY (`goods_receiving_item_id`) REFERENCES `goods_receiving_items` (`id`) ON DELETE SET NULL,
  CONSTRAINT `supplier_return_items_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `supplier_return_items_supplier_return_id_foreign` FOREIGN KEY (`supplier_return_id`) REFERENCES `supplier_returns` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_return_items`
--

LOCK TABLES `supplier_return_items` WRITE;
/*!40000 ALTER TABLE `supplier_return_items` DISABLE KEYS */;
INSERT INTO `supplier_return_items` VALUES
(1,1,5,13,1,7600.00,'Kemasan penyok','Belum diproses, masih menunggu pickup.','2026-05-06 03:40:40','2026-05-06 03:40:40'),
(2,2,3,10,2,24800.00,'Segel kemasan rusak','Dikembalikan saat inspeksi inbound.','2026-05-06 03:40:40','2026-05-06 03:40:40');
/*!40000 ALTER TABLE `supplier_return_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `supplier_returns`
--

DROP TABLE IF EXISTS `supplier_returns`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `supplier_returns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `supplier_id` bigint(20) unsigned DEFAULT NULL,
  `goods_receiving_id` bigint(20) unsigned DEFAULT NULL,
  `payable_id` bigint(20) unsigned DEFAULT NULL,
  `document_number` varchar(255) NOT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `returned_at` timestamp NULL DEFAULT NULL,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `supplier_returns_document_number_unique` (`document_number`),
  KEY `supplier_returns_supplier_id_foreign` (`supplier_id`),
  KEY `supplier_returns_goods_receiving_id_foreign` (`goods_receiving_id`),
  KEY `supplier_returns_payable_id_foreign` (`payable_id`),
  KEY `supplier_returns_created_by_foreign` (`created_by`),
  CONSTRAINT `supplier_returns_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `supplier_returns_goods_receiving_id_foreign` FOREIGN KEY (`goods_receiving_id`) REFERENCES `goods_receivings` (`id`) ON DELETE CASCADE,
  CONSTRAINT `supplier_returns_payable_id_foreign` FOREIGN KEY (`payable_id`) REFERENCES `payables` (`id`) ON DELETE SET NULL,
  CONSTRAINT `supplier_returns_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `supplier_returns`
--

LOCK TABLES `supplier_returns` WRITE;
/*!40000 ALTER TABLE `supplier_returns` DISABLE KEYS */;
INSERT INTO `supplier_returns` VALUES
(1,3,2,6,'SR-20260506-0001','draft','Draft retur untuk yogurt penyok, menunggu persetujuan supplier.',NULL,1,'2026-05-05 19:40:40','2026-05-05 19:40:40'),
(2,3,2,6,'SR-20260506-0002','completed','Retur barang rusak dari batch frozen food.','2026-05-05 21:40:40',1,'2026-05-05 21:40:40','2026-05-05 21:40:40');
/*!40000 ALTER TABLE `supplier_returns` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `suppliers`
--

DROP TABLE IF EXISTS `suppliers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `suppliers` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `suppliers`
--

LOCK TABLES `suppliers` WRITE;
/*!40000 ALTER TABLE `suppliers` DISABLE KEYS */;
INSERT INTO `suppliers` VALUES
(1,'PT Sumber Pangan Nusantara','0215551001','sales@sumberpangan.test','Jl. Industri Pangan No. 10, Jakarta','2026-05-06 03:40:09','2026-05-06 03:40:09'),
(2,'CV Makmur Jaya Distribusi','0225551002','order@makmurjaya.test','Jl. Soekarno Hatta No. 88, Bandung','2026-05-06 03:40:09','2026-05-06 03:40:09'),
(3,'PT Segar Sentosa Abadi','0315551003','hello@segarsentosa.test','Jl. Raya Darmo No. 21, Surabaya','2026-05-06 03:40:09','2026-05-06 03:40:09'),
(4,'UD Berkah Retail Grosir','0245551004','admin@berkahretail.test','Jl. Pandanaran No. 45, Semarang','2026-05-06 03:40:09','2026-05-06 03:40:09');
/*!40000 ALTER TABLE `suppliers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transaction_details`
--

DROP TABLE IF EXISTS `transaction_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `transaction_details` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `transaction_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `qty` int(11) NOT NULL,
  `base_unit_price` bigint(20) NOT NULL DEFAULT 0,
  `unit_price` bigint(20) NOT NULL DEFAULT 0,
  `price` bigint(20) NOT NULL,
  `discount_total` bigint(20) NOT NULL DEFAULT 0,
  `pricing_rule_id` bigint(20) unsigned DEFAULT NULL,
  `pricing_rule_name` varchar(255) DEFAULT NULL,
  `pricing_rule_kind` varchar(30) DEFAULT NULL,
  `pricing_group_key` varchar(255) DEFAULT NULL,
  `pricing_group_label` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transaction_details_transaction_id_foreign` (`transaction_id`),
  KEY `transaction_details_product_id_foreign` (`product_id`),
  KEY `transaction_details_pricing_rule_id_foreign` (`pricing_rule_id`),
  CONSTRAINT `transaction_details_pricing_rule_id_foreign` FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transaction_details_product_id_foreign` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `transaction_details_transaction_id_foreign` FOREIGN KEY (`transaction_id`) REFERENCES `transactions` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transaction_details`
--

LOCK TABLES `transaction_details` WRITE;
/*!40000 ALTER TABLE `transaction_details` DISABLE KEYS */;
INSERT INTO `transaction_details` VALUES
(1,1,1,3,0,0,15000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(2,1,5,2,0,0,24000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(3,1,15,1,0,0,16000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(4,2,12,2,0,0,42000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(5,2,16,3,0,0,24000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(6,2,21,2,0,0,13000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(7,3,10,2,0,0,76000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(8,3,19,1,0,0,38000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(9,3,24,2,0,0,44000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(10,4,3,2,0,0,36000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(11,4,7,5,0,0,17500,0,NULL,NULL,NULL,NULL,NULL,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(12,4,13,2,0,0,24000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(13,5,22,1,0,0,32000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(14,5,18,2,0,0,50000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(15,5,11,2,0,0,96000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(16,5,26,1,0,0,26000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(17,6,2,2,0,0,12000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:00:00','2026-05-06 03:00:00'),
(18,6,6,1,0,0,15000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 03:00:00','2026-05-06 03:00:00'),
(19,7,16,1,8000,8000,8000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 21:10:43','2026-05-06 21:10:43'),
(20,7,17,1,15000,15000,15000,0,NULL,NULL,NULL,NULL,NULL,'2026-05-06 21:10:43','2026-05-06 21:10:43');
/*!40000 ALTER TABLE `transaction_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `transactions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cashier_id` bigint(20) unsigned NOT NULL,
  `cashier_shift_id` bigint(20) unsigned DEFAULT NULL,
  `customer_id` bigint(20) unsigned DEFAULT NULL,
  `bank_account_id` bigint(20) unsigned DEFAULT NULL,
  `invoice` varchar(255) NOT NULL,
  `cash` bigint(20) NOT NULL,
  `change` bigint(20) NOT NULL,
  `discount` bigint(20) NOT NULL,
  `loyalty_points_earned` int(10) unsigned NOT NULL DEFAULT 0,
  `loyalty_points_redeemed` int(10) unsigned NOT NULL DEFAULT 0,
  `loyalty_discount_total` bigint(20) unsigned NOT NULL DEFAULT 0,
  `customer_voucher_discount` bigint(20) unsigned NOT NULL DEFAULT 0,
  `customer_voucher_code` varchar(255) DEFAULT NULL,
  `customer_voucher_name` varchar(255) DEFAULT NULL,
  `shipping_cost` decimal(15,2) NOT NULL DEFAULT 0.00,
  `grand_total` bigint(20) NOT NULL,
  `payment_method` varchar(255) NOT NULL DEFAULT 'cash',
  `payment_status` varchar(255) NOT NULL DEFAULT 'paid',
  `payment_reference` varchar(255) DEFAULT NULL,
  `payment_url` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transactions_cashier_id_foreign` (`cashier_id`),
  KEY `transactions_customer_id_foreign` (`customer_id`),
  KEY `transactions_bank_account_id_foreign` (`bank_account_id`),
  KEY `transactions_cashier_shift_id_foreign` (`cashier_shift_id`),
  CONSTRAINT `transactions_bank_account_id_foreign` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transactions_cashier_id_foreign` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`),
  CONSTRAINT `transactions_cashier_shift_id_foreign` FOREIGN KEY (`cashier_shift_id`) REFERENCES `cashier_shifts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `transactions_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `transactions`
--

LOCK TABLES `transactions` WRITE;
/*!40000 ALTER TABLE `transactions` DISABLE KEYS */;
INSERT INTO `transactions` VALUES
(1,2,1,1,NULL,'TRX-BHYKODRS',20000,0,5000,0,0,0,0,NULL,NULL,0.00,50000,'credit','unpaid',NULL,NULL,'2026-05-04 02:00:00','2026-05-04 02:00:00'),
(2,2,1,2,NULL,'TRX-WZEDFSQA',55300,0,0,0,0,0,0,NULL,NULL,0.00,79000,'credit','unpaid',NULL,NULL,'2026-05-04 03:00:00','2026-05-04 03:00:00'),
(3,2,2,3,NULL,'TRX-EAP7GPAE',0,0,10000,0,0,0,0,NULL,NULL,0.00,148000,'credit','unpaid',NULL,NULL,'2026-05-05 03:00:00','2026-05-05 03:00:00'),
(4,2,2,4,NULL,'TRX-DTMCIQGU',80000,2500,0,0,0,0,0,NULL,NULL,0.00,77500,'cash','paid',NULL,NULL,'2026-05-05 04:00:00','2026-05-05 04:00:00'),
(5,2,3,6,NULL,'TRX-NV8KT9PJ',250000,61000,15000,0,0,0,0,NULL,NULL,0.00,189000,'cash','paid',NULL,NULL,'2026-05-06 02:00:00','2026-05-06 02:00:00'),
(6,2,3,NULL,1,'TRX-KF2AIQXF',27000,0,0,0,0,0,0,NULL,NULL,0.00,27000,'bank_transfer','paid','TRF-TRX-KF2AIQXF',NULL,'2026-05-06 03:00:00','2026-05-06 03:40:39'),
(7,1,4,9,NULL,'TRX-80A1S73F0M',50000,27000,0,0,0,0,0,NULL,NULL,0.00,23000,'cash','paid',NULL,NULL,'2026-05-06 21:10:43','2026-05-06 21:10:43');
/*!40000 ALTER TABLE `transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES
(1,'Athikur Rakhman','teknosuper@gmail.com',NULL,'$2y$12$BNL5oEITDXtAgB6H53XDfugQjvZvUJbfHU0D.L0oHHaHif4N7M8Bm','OhKfPVKsXULumvGjNTUcVdS8e4J57yNWKalshNeYDNL2RsYFXVfyYuFqQOUq','2026-05-06 03:40:08','2026-05-06 03:40:08',NULL),
(2,'Cashier','cashier@gmail.com',NULL,'$2y$12$.s5sCRjIwv5bH/Ui1f6UkusDShDbEw6oIqxSmRTwTysVG34NmfloW',NULL,'2026-05-06 03:40:08','2026-05-06 03:40:08',NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-08  7:14:17

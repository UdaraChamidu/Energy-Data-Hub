CREATE DATABASE  IF NOT EXISTS `scraper` /*!40100 DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci */;
USE `scraper`;
-- MySQL dump 10.13  Distrib 8.0.46, for macos15 (arm64)
--
-- Host: 10.20.10.115    Database: scraper
-- ------------------------------------------------------
-- Server version	5.5.5-10.3.39-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `15mincomp`
--

DROP TABLE IF EXISTS `15mincomp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `15mincomp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date1` date NOT NULL,
  `date2` date NOT NULL,
  `date3` date NOT NULL,
  `date4` date NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `15minhighlimit`
--

DROP TABLE IF EXISTS `15minhighlimit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `15minhighlimit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `limitcur` decimal(10,2) NOT NULL,
  `days` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `15minlowlimit`
--

DROP TABLE IF EXISTS `15minlowlimit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `15minlowlimit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `limitcur` decimal(10,2) NOT NULL,
  `days` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `60mincomp`
--

DROP TABLE IF EXISTS `60mincomp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `60mincomp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date1` date NOT NULL,
  `date2` date NOT NULL,
  `date3` date NOT NULL,
  `date4` date NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `60minhighlimit`
--

DROP TABLE IF EXISTS `60minhighlimit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `60minhighlimit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `limitcur` decimal(10,2) NOT NULL,
  `days` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `60minlowlimit`
--

DROP TABLE IF EXISTS `60minlowlimit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `60minlowlimit` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `limitcur` decimal(10,2) NOT NULL,
  `days` int(11) NOT NULL,
  `count` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `intracomp`
--

DROP TABLE IF EXISTS `intracomp`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `intracomp` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date1` date NOT NULL,
  `date2` date NOT NULL,
  `date3` date NOT NULL,
  `date4` date NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netzdaten_chronik`
--

DROP TABLE IF EXISTS `netzdaten_chronik`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netzdaten_chronik` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `curtime` datetime NOT NULL,
  `datatime` datetime NOT NULL,
  `freqplan` decimal(25,2) NOT NULL,
  `freqact` decimal(25,3) NOT NULL,
  `freqdelta` decimal(25,3) NOT NULL,
  `gridtimedev` decimal(25,3) NOT NULL,
  `gridtimeplan` int(11) NOT NULL DEFAULT 0,
  `buyvolume` decimal(10,1) NOT NULL DEFAULT 0.0,
  `sellvolume` decimal(10,1) NOT NULL DEFAULT 0.0,
  `volume` decimal(10,1) NOT NULL DEFAULT 0.0,
  `price` decimal(10,2) NOT NULL DEFAULT 0.00,
  `15minhigh` decimal(10,2) NOT NULL DEFAULT 0.00,
  `15minlow` decimal(10,2) NOT NULL DEFAULT 0.00,
  `15minlast` decimal(10,2) NOT NULL DEFAULT 0.00,
  `30minhigh` decimal(10,2) NOT NULL DEFAULT 0.00,
  `30minlow` decimal(10,2) NOT NULL DEFAULT 0.00,
  `30minlast` decimal(10,2) NOT NULL DEFAULT 0.00,
  `1hrhigh` decimal(10,2) NOT NULL DEFAULT 0.00,
  `1hrlow` decimal(10,2) NOT NULL DEFAULT 0.00,
  `1hrlast` decimal(10,2) NOT NULL DEFAULT 0.00,
  `intracompdate` datetime NOT NULL,
  `15mincompdate` datetime NOT NULL,
  `60mincompdate` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5413649 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `netzdaten_manuell`
--

DROP TABLE IF EXISTS `netzdaten_manuell`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `netzdaten_manuell` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datum` date NOT NULL,
  `biomasse` decimal(11,0) NOT NULL,
  `wasserkraft` decimal(11,0) NOT NULL,
  `wind_offshore` decimal(11,0) NOT NULL,
  `wind_onshore` decimal(11,0) NOT NULL,
  `photovoltaik` decimal(11,0) NOT NULL,
  `sonstige_erneuerbare` decimal(11,0) NOT NULL,
  `kernenergie` decimal(11,0) NOT NULL,
  `braunkohle` decimal(11,0) NOT NULL,
  `steinkohle` decimal(11,0) NOT NULL,
  `erdgas` decimal(11,0) NOT NULL,
  `pumpspeicher` decimal(11,0) NOT NULL,
  `sonstige_konventionelle` decimal(11,0) NOT NULL,
  `gesamt_netzlast` decimal(11,0) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `params`
--

DROP TABLE IF EXISTS `params`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `params` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `se` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `var1` varchar(255) NOT NULL,
  `var2` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tempcont15`
--

DROP TABLE IF EXISTS `tempcont15`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tempcont15` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datum` date NOT NULL,
  `low` decimal(10,2) NOT NULL,
  `high` decimal(10,2) NOT NULL,
  `last` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tempcont1h`
--

DROP TABLE IF EXISTS `tempcont1h`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tempcont1h` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datum` date NOT NULL,
  `low` decimal(10,2) NOT NULL,
  `high` decimal(10,2) NOT NULL,
  `last` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tempcont30`
--

DROP TABLE IF EXISTS `tempcont30`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tempcont30` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datum` date NOT NULL,
  `low` decimal(10,2) NOT NULL,
  `high` decimal(10,2) NOT NULL,
  `last` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tempintra15`
--

DROP TABLE IF EXISTS `tempintra15`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tempintra15` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `datum` date NOT NULL,
  `buy` decimal(10,1) NOT NULL,
  `sell` decimal(10,1) NOT NULL,
  `volume` decimal(10,1) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `timeidx15`
--

DROP TABLE IF EXISTS `timeidx15`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timeidx15` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `von` time NOT NULL,
  `bis` time NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=97 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `timeidx1h`
--

DROP TABLE IF EXISTS `timeidx1h`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timeidx1h` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `von` time NOT NULL,
  `bis` time NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `timeidx30`
--

DROP TABLE IF EXISTS `timeidx30`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `timeidx30` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `von` time NOT NULL,
  `bis` time NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-01 11:42:31

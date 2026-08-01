<?php
include("proxyConnector.class.php");

//Connect to the DB
require_once('Connections/dbconnect.php');

//Load Simple HTML DOM Class
require_once('simple_html_dom.php');

	
        //list of browsers
        $agentBrowser = array(
                'Firefox',
                'Safari',
                'Opera',
                'Flock',
                'Internet Explorer',
                'Seamonkey',
                'Konqueror',
                'GoogleBot'
        );
        //list of operating systems
        $agentOS = array(
                'Windows 98',
                'Windows 2000',
                'Windows NT',
                'Windows XP',
                'Windows Vista',
                'Redhat Linux',
                'Ubuntu',
                'Fedora',
                'AmigaOS',
                'OS 10.9',
				'OS 10.10',
				'OS 10.11',
				'OS 10.12',
				'OS 10.13',
				'OS 10.14',
				'OS 10.15'
        );
        //randomly generate UserAgent
        $userAgentrand = $agentBrowser[rand(0,7)].'/'.rand(1,8).'.'.rand(0,9).' (' .$agentOS[rand(0,11)].' '.rand(1,7).'.'.rand(0,9).'; de-DE;)';
	    $userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
	//Primary Loop
	
	
	$searchportal = mysqli_query($connection, "SELECT * FROM `scraper`.`params` WHERE `se` = 'INTRA'");
	$sprow = mysqli_fetch_array($searchportal);

    $searchportal1 = mysqli_query($connection, "SELECT * FROM `scraper`.`params` WHERE `se` = 'CONT15'");
	$sprow1 = mysqli_fetch_array($searchportal1);
	
	$searchportal2 = mysqli_query($connection, "SELECT * FROM `scraper`.`params` WHERE `se` = 'CONT1H'");
	$sprow2 = mysqli_fetch_array($searchportal2);
	
	$torproxy = proxyConnector::getIstance();		
    $torproxy->launch("https://whatismyipaddress.com/", null);
	$cycleIP = $torproxy->getProxyData();
	
	$torSocks5Proxy = "socks5://127.0.0.1:9050";
	
	
   
    $ch8 = curl_init();
	$path_cookie = 'cookie1.txt';
	
	curl_setopt ($ch8, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5 );
	curl_setopt ($ch8, CURLOPT_PROXY, $torSocks5Proxy );
	curl_setopt ($ch8 ,CURLOPT_USERAGENT, $userAgent);
	curl_setopt ($ch8, CURLOPT_URL, $sprow['url'].date("Y-m-d", time() - 60 * 60 * 24).$sprow['var1'].date("Y-m-d").$sprow['var2']);
    curl_setopt ($ch8, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt ($ch8, CURLOPT_COOKIESESSION, true);
	curl_setopt ($ch8, CURLOPT_COOKIEJAR, realpath($path_cookie));
    curl_setopt ($ch8, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt ($ch8, CURLOPT_VERBOSE, true); 
	$header[0] = "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,";
	$header[0] .= "**;q=0.8";
	$header[] = "Accept-Charset: utf-8;q=0.7,*;q=0.7";
	$header[] = "Accept-Language: en-US,en;q=0.5";
	curl_setopt($ch8, CURLOPT_HTTPHEADER, $header);
    
	$curl_scraped_page8 = curl_exec($ch8);
	
	//echo $cycleIP;
	echo $curl_scraped_page8;
	
	
  
  
    $ch9 = curl_init();
	$path_cookie1 = 'cookie2.txt';
	
	curl_setopt ($ch9, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5 );
	curl_setopt ($ch9, CURLOPT_PROXY, $torSocks5Proxy );
	curl_setopt ($ch9 ,CURLOPT_USERAGENT, $userAgent);
	curl_setopt ($ch9, CURLOPT_URL, $sprow1['url'].date("Y-m-d").$sprow1['var1']);
    curl_setopt ($ch9, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt ($ch9, CURLOPT_COOKIESESSION, true);
	curl_setopt ($ch9, CURLOPT_COOKIEJAR, realpath($path_cookie1));
    curl_setopt ($ch9, CURLOPT_FOLLOWLOCATION, true);
	$header[0] = "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,";
	$header[0] .= "**;q=0.8";
	$header[] = "Accept-Charset: utf-8;q=0.7,*;q=0.7";
	$header[] = "Accept-Language: en-US,en;q=0.5";
	curl_setopt($ch9, CURLOPT_HTTPHEADER, $header);
    
	$curl_scraped_page9 = curl_exec($ch9);
	
    //echo $curl_scraped_page9;
  
  

    $ch10 = curl_init();
	$path_cookie2 = 'cookie3.txt';
	
	curl_setopt ($ch10, CURLOPT_PROXYTYPE, CURLPROXY_SOCKS5 );
	curl_setopt ($ch10, CURLOPT_PROXY, $torSocks5Proxy );
	curl_setopt ($ch10 ,CURLOPT_USERAGENT, $userAgent);
	curl_setopt ($ch10, CURLOPT_URL, $sprow2['url'].date("Y-m-d").$sprow2['var1']);
    curl_setopt ($ch10, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt ($ch10, CURLOPT_COOKIESESSION, true);
	curl_setopt ($ch10, CURLOPT_COOKIEJAR, realpath($path_cookie2));
    curl_setopt ($ch10, CURLOPT_FOLLOWLOCATION, true);
	$header[0] = "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,";
	$header[0] .= "**;q=0.8";
	$header[] = "Accept-Charset: utf-8;q=0.7,*;q=0.7";
	$header[] = "Accept-Language: en-US,en;q=0.5";
	curl_setopt($ch10, CURLOPT_HTTPHEADER, $header);
    
	$curl_scraped_page10 = curl_exec($ch10);
	
    // echo $curl_scraped_page10;
    
    $html8 = new simple_html_dom();
    $html8->load($curl_scraped_page8, true, false);

$rowData = array();

$count = -1;
foreach($html8->find('tr.child') as $row) {
    
    // initialize array to store the cell data from each row
    $flight = array();
    foreach($row->find('td') as $cell) {
        // push the cell's text to the array
        $flight[] = $cell->plaintext;
    }
    $rowData[] = $flight;
    
    $count = $count + 1;
    $datum = date("Y-m-d");
    $buy = $rowData[$count][0];
    $sell = $rowData[$count][1];
    $volume = $rowData[$count][2];
    $price = $rowData[$count][3];
    
    $query ="INSERT INTO `scraper`.`tempintra15` (datum, buy, sell, volume, price) VALUES ('".$datum."','".$buy."','".$sell."','".$volume."','".$price."')";
        mysqli_query($connection, $query);
}

$query31 = mysqli_query($connection, "SELECT datum, von, bis, buy, sell, volume, price FROM tempintra15 left join timeidx15 on timeidx15.id = tempintra15.id");

while($arr31 = mysqli_fetch_array($query31)) {
    //echo $arr21['datum']." ".$arr21['von']." ".$arr21['bis']." ".$arr21['low']." ".$arr21['high']." ".$arr21['last'];
    $dt31 = $arr31['datum']." ".$arr31['von'];
    $dt32 = $arr31['datum']." ".$arr31['bis'];
    mysqli_query($connection, "UPDATE netzdaten_chronik SET buyvolume = ".$arr31['buy'].", sellvolume = ".$arr31['sell'].", volume = ".$arr31['volume'].", price = ".$arr31['price']." WHERE curtime >= '$dt31' AND curtime <= '$dt32'");
    mysqli_query($connection, "TRUNCATE TABLE tempintra15;");
}


/*
echo '<table>';
foreach ($rowData as $row => $tr) {
    $count = $count + 1;
    echo '<tr><td>'.$count.'|</td>'; 
    foreach ($tr as $td)
        echo '<td>' . $td .'</td>';
    echo '</tr>';
}
echo '</table>';
*/




    //$html8->clear();
    unset($html8);
	curl_close($ch8);
	
	
	
	
	
	
$html9 = new simple_html_dom();
    $html9->load($curl_scraped_page9, true, false);

$rowData1 = array();

$count1 = -1;
$columnNumbers = [ 0, 1, 2];
foreach($html9->find('tr.child-0.lvl-2.,tr.child-1.impair.lvl-2,tr.child-2.lvl-2.,tr.child-3.impair.lvl-2,tr.child-4.lvl-2.,tr.child-5.impair.lvl-2,tr.child-6.lvl-2.,tr.child-7.impair.lvl-2,tr.child-8.lvl-2.,tr.child-9.impair.lvl-2,tr.child-10.lvl-2.,tr.child-11.impair.lvl-2,tr.child-12.lvl-2.,tr.child-13.impair.lvl-2,tr.child-14.lvl-2.,tr.child-15.impair.lvl-2,tr.child-16.lvl-2.,tr.child-17.impair.lvl-2,tr.child-18.lvl-2.,tr.child-19.impair.lvl-2,tr.child-20.lvl-2.,tr.child-21.impair.lvl-2,tr.child-22.lvl-2.,tr.child-23.impair.lvl-2') as $row1) {
    
    // initialize array to store the cell data from each row
    $flight1 = array();
    foreach($row1->find('td') as $columnNumber => $cell1) {
        if ( in_array( $columnNumber, $columnNumbers ) ) {
        // push the cell's text to the array
        $flight1[] = $cell1->plaintext;
        }
    }
    $rowData1[] = $flight1;
    //print_r($rowData1);
    
    $count1 = $count1 + 1;
    $datum1 = date("Y-m-d");
    $low1 = $rowData1[$count1][0];
    $high1 = $rowData1[$count1][1];
    $last1 = $rowData1[$count1][2];
    
    $query1 ="INSERT INTO `scraper`.`tempcont15` (datum, low, high, last) VALUES ('".$datum1."','".$low1."','".$high1."','".$last1."')";
        mysqli_query($connection, $query1);
}

$query11 = mysqli_query($connection, "SELECT datum, von, bis, low, high, last FROM tempcont15 left join timeidx15 on timeidx15.id = tempcont15.id");

while($arr11 = mysqli_fetch_array($query11)) {
    //echo $arr21['datum']." ".$arr21['von']." ".$arr21['bis']." ".$arr21['low']." ".$arr21['high']." ".$arr21['last'];
    $dt11 = $arr11['datum']." ".$arr11['von'];
    $dt12 = $arr11['datum']." ".$arr11['bis'];
    mysqli_query($connection, "UPDATE netzdaten_chronik SET 15minhigh = ".$arr11['high'].", 15minlow = ".$arr11['low'].", 15minlast = ".$arr11['last']." WHERE curtime >= '$dt11' AND curtime <= '$dt12'");
    mysqli_query($connection, "TRUNCATE TABLE tempcont15;");
}


/*
echo '<table>';
foreach ($rowData1 as $row1 => $tr1) {
    //$count1 = $count1 + 1;
    echo '<tr>'; 
    foreach ($tr1 as $td1)
        echo '<td>' . $td1 .'</td>';
    echo '</tr>';
}
echo '</table>';
*/





    //$html9->clear();
    unset($html9);
	curl_close($ch9);
	
	
	
$html10 = new simple_html_dom();
    $html10->load($curl_scraped_page10, true, false);

$rowData2 = array();

$count2 = -1;
$columnNumbers = [ 0, 1, 2];
foreach($html10->find('tr[class=child-0],tr[class=child-1 impair],tr[class=child-2],tr[class=child-3 impair],tr[class=child-4],tr[class=child-5 impair],tr[class=child-6],tr[class=child-7 impair],tr[class=child-8],tr[class=child-9 impair],tr[class=child-10],tr[class=child-11 impair],tr[class=child-12],tr[class=child-13 impair],tr[class=child-14],tr[class=child-15 impair],tr[class=child-16],tr[class=child-17 impair],tr[class=child-18],tr[class=child-19 impair],tr[class=child-20],tr[class=child-21 impair],tr[class=child-22],tr[class=child-23 impair]') as $row2) {
    
    // initialize array to store the cell data from each row
    $flight2 = array();
    foreach($row2->find('td') as $columnNumber => $cell2) {
        if ( in_array( $columnNumber, $columnNumbers ) ) {
        // push the cell's text to the array
        $flight2[] = $cell2->plaintext;
        }
    }
    $rowData2[] = $flight2;
    
    $count2 = $count2 + 1;
    $datum2 = date("Y-m-d");
    $low2 = $rowData2[$count2][0];
    $high2 = $rowData2[$count2][1];
    $last2 = $rowData2[$count2][2];
    
    $query2 ="INSERT INTO `scraper`.`tempcont1h` (datum, low, high, last) VALUES ('".$datum2."','".$low2."','".$high2."','".$last2."')";
        mysqli_query($connection, $query2);
        
}

$query21 = mysqli_query($connection, "SELECT datum, von, bis, low, high, last FROM tempcont1h left join timeidx1h on timeidx1h.id = tempcont1h.id");

while($arr21 = mysqli_fetch_array($query21)) {
    //echo $arr21['datum']." ".$arr21['von']." ".$arr21['bis']." ".$arr21['low']." ".$arr21['high']." ".$arr21['last'];
    $dt1 = $arr21['datum']." ".$arr21['von'];
    $dt2 = $arr21['datum']." ".$arr21['bis'];
    mysqli_query($connection, "UPDATE netzdaten_chronik SET 1hrhigh = ".$arr21['high'].", 1hrlow = ".$arr21['low'].", 1hrlast = ".$arr21['last']." WHERE curtime >= '$dt1' AND curtime <= '$dt2'");
    mysqli_query($connection, "TRUNCATE TABLE tempcont1h;");
}
    


/*
echo '<table>';
foreach ($rowData2 as $row2 => $tr2) {
    $count2 = $count2 + 1;
    echo '<tr><td>'.$count2.'|</td>'; 
    foreach ($tr2 as $td2)
        echo '<td>' . $td2 .'</td>';
    echo '</tr>';
}
echo '</table>';
*/




    //$html10->clear();
    unset($html10);
	curl_close($ch10);
	exit();
    
    
    

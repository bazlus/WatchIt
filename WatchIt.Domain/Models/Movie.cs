namespace WatchIt.Data.Models;
using System.Collections.Generic;

public class Movie
{
    public int Id { get; set; }
    public string Name { get; set; }
    public IEnumerable<Like> Likes { get; set; }
}
